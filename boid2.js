const canvas = document.getElementById('boidsCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

// ─── Background Gradients ────────────────────────────────────────────────────
const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
gradient.addColorStop(0,   'rgb(190, 163, 163)');
gradient.addColorStop(0.2, 'rgb(206, 199, 181)');
gradient.addColorStop(0.9, 'rgb(195, 188, 173)');
gradient.addColorStop(1,   'rgb(179, 163, 180)');

let ovalGradient;
function createOvalGradient() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const rx = canvas.width * 0.6, ry = canvas.height * 0.35;
    ovalGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    ovalGradient.addColorStop(0,   'rgba(255, 227, 150, 0.88)');
    ovalGradient.addColorStop(0.7, 'rgba(197, 189, 248, 0.46)');
    ovalGradient.addColorStop(1,   'rgba(211, 200, 200, 0.55)');
}
createOvalGradient();

// The background never changes frame-to-frame (only on resize), but a
// linear gradient fill + radial gradient ellipse fill over the *entire*
// canvas is one of the most expensive things to rasterize in canvas 2D.
// Render it once into an offscreen canvas and just blit that bitmap every
// frame instead of recomputing both gradients 30x/sec.
const bgCanvas = document.createElement('canvas');
const bgCtx    = bgCanvas.getContext('2d', { alpha: false });
function renderBackground() {
    bgCanvas.width  = canvas.width;
    bgCanvas.height = canvas.height;
    bgCtx.fillStyle = gradient;
    bgCtx.fillRect(0, 0, canvas.width, canvas.height);
    bgCtx.fillStyle = ovalGradient;
    bgCtx.beginPath();
    bgCtx.ellipse(canvas.width/2, canvas.height/2, canvas.width*0.9, canvas.height*0.9, 0, 0, Math.PI*2);
    bgCtx.fill();
}
renderBackground();

// ─── Image Loader ────────────────────────────────────────────────────────────
function loadImages(sources, callback) {
    const loaded = [];
    let completed = 0;
    if (sources.length === 0) { callback(loaded); return; }
    sources.forEach(source => {
        const img = new Image();
        img.onload = () => {
            loaded.push(img);
            if (++completed >= sources.length) callback(loaded);
        };
        img.onerror = () => {
            console.warn('Failed to load image:', source);
            if (++completed >= sources.length) callback(loaded);
        };
        img.src = source;
    });
}

// ─── Vector ──────────────────────────────────────────────────────────────────
class Vector {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    static subtract(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y); }
    add(v)      { this.x += v.x; this.y += v.y; }
    subtract(v) { this.x -= v.x; this.y -= v.y; }
    multiply(s) { this.x *= s;   this.y *= s; }
    divide(s)   { this.x /= s;   this.y /= s; }
    magnitude() { return Math.sqrt(this.x ** 2 + this.y ** 2); }
    normalize() { const m = this.magnitude(); if (m > 0) this.divide(m); }
    limit(max)  { if (this.magnitude() > max) { this.normalize(); this.multiply(max); } }
    distance(v) { const dx = this.x - v.x, dy = this.y - v.y; return Math.sqrt(dx*dx + dy*dy); }
}

// ─── Base Boid ───────────────────────────────────────────────────────────────
class Boid {
    constructor(imageArray, cfg) {
        this.position     = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
        this.velocity     = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        this.acceleration = new Vector();
        this.image        = imageArray[Math.floor(Math.random() * imageArray.length)];

        this.maxSpeed     = cfg.speedMin + Math.random() * cfg.speedRange;
        this.maxForce     = cfg.maxForce;
        this.scale        = cfg.scaleMin + Math.random() * cfg.scaleRange;
        this.flockWeight  = cfg.flockWeight;
        this.perceptionR  = cfg.perceptionR;

        this.opacity      = 0;
        this.fadeState    = 'in';
        this.fadeSpeed    = cfg.fadeSpeedMin + Math.random() * cfg.fadeSpeedRange;
        this.rotation     = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * cfg.rotationRange;

        this.active = false;   // start inactive, spawned later
    }

    edges() {
        const margin = 200;  // ← increased for smoother off-screen fade
        if (this.fadeState === 'visible') {
            if (this.position.x > canvas.width  - margin || this.position.x < margin ||
                this.position.y > canvas.height - margin || this.position.y < margin) {
                this.fadeState = 'out';
            }
        }
        if (this.opacity <= 0 && this.fadeState === 'out') {
            if (this.position.x > canvas.width)  this.position.x = 0;
            if (this.position.x < 0)             this.position.x = canvas.width;
            if (this.position.y > canvas.height) this.position.y = 0;
            if (this.position.y < 0)             this.position.y = canvas.height;
            this.fadeState = 'in';
        }
    }

    // Turns a raw summed vector (sx, sy) into a steering force and adds it
    // straight into this.acceleration, scaled by flockWeight. No allocation.
    _applySteer(sx, sy, weight) {
        let mag = Math.sqrt(sx * sx + sy * sy);
        if (mag === 0) return;
        // normalize, scale to maxSpeed
        sx = (sx / mag) * this.maxSpeed;
        sy = (sy / mag) * this.maxSpeed;
        // subtract current velocity
        sx -= this.velocity.x;
        sy -= this.velocity.y;
        // limit to maxForce
        mag = Math.sqrt(sx * sx + sy * sy);
        if (mag > this.maxForce) {
            sx = (sx / mag) * this.maxForce;
            sy = (sy / mag) * this.maxForce;
        }
        this.acceleration.x += sx * weight;
        this.acceleration.y += sy * weight;
    }

    // Single pass over neighbors computing align + cohesion + separation
    // together (was 3 separate passes). Uses squared distances (no sqrt in
    // the hot loop) and plain numbers instead of Vector objects.
    flock(boids) {
        if (this.flockWeight === 0) return;

        const r      = this.perceptionR;
        const rSq    = r * r;
        const sepR   = r * 0.55;
        const sepRSq = sepR * sepR;

        let alignX = 0, alignY = 0, alignTotal = 0;
        let cohX   = 0, cohY   = 0, cohTotal   = 0;
        let sepX   = 0, sepY   = 0, sepTotal   = 0;

        const maxCheck = Math.min(25, boids.length);
        for (let i = 0; i < maxCheck; i++) {
            const other = boids[Math.floor(Math.random() * boids.length)];
            if (other === this) continue;

            const dx = other.position.x - this.position.x;
            const dy = other.position.y - this.position.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < rSq) {
                alignX += other.velocity.x; alignY += other.velocity.y; alignTotal++;
                cohX   += other.position.x; cohY   += other.position.y; cohTotal++;
            }
            if (distSq < sepRSq && distSq > 0) {
                sepX -= dx / distSq; sepY -= dy / distSq; sepTotal++;
            }
        }

        if (alignTotal > 0) {
            this._applySteer(alignX / alignTotal, alignY / alignTotal, this.flockWeight);
        }
        if (cohTotal > 0) {
            this._applySteer(
                (cohX / cohTotal) - this.position.x,
                (cohY / cohTotal) - this.position.y,
                this.flockWeight
            );
        }
        if (sepTotal > 0) {
            this._applySteer(sepX / sepTotal, sepY / sepTotal, this.flockWeight);
        }
    }

    updateFade() {
        if (this.fadeState === 'in' && this.opacity < 1) {
            this.opacity += this.fadeSpeed;
            if (this.opacity >= 1) { this.opacity = 1; this.fadeState = 'visible'; }
        } else if (this.fadeState === 'out' && this.opacity > 0) {
            this.opacity -= this.fadeSpeed;
            if (this.opacity <= 0) this.opacity = 0;
        }
    }

    update() {
        if (!this.active) return;

        this.position.add(this.velocity);
        this.velocity.add(this.acceleration);
        this.velocity.limit(this.maxSpeed);
        this.acceleration.multiply(0);
        this.updateFade();
        this.rotation += this.rotationSpeed;
        if (this.rotation >  Math.PI * 2) this.rotation -= Math.PI * 2;
        if (this.rotation < 0)            this.rotation += Math.PI * 2;
        this.edges();
    }

    // zoom: layer-level scale factor (1 = no zoom). cx/cy: point the zoom
    // is centered on (canvas center). Folded directly into the same
    // transform matrix as rotation/position, so this costs almost nothing.
    draw(zoom = 1, cx = 0, cy = 0) {
        if (!this.active || this.opacity <= 0) return;
        if (!this.image || this.image.width === 0) return;
        ctx.globalAlpha = this.opacity;
        const w = this.image.width  * this.scale * zoom;
        const h = this.image.height * this.scale * zoom;
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        // position scaled toward/away from (cx, cy) by the zoom factor
        const px = zoom * this.position.x + cx * (1 - zoom);
        const py = zoom * this.position.y + cy * (1 - zoom);
        ctx.setTransform(cos, sin, -sin, cos, px, py);
        ctx.drawImage(this.image, -w / 2, -h / 2, w, h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
    }
}

// ─── Layer Configs ───────────────────────────────────────────────────────────

const BACK_CFG = {
    // Numerous, tiny, fast-moving – the background swarm
    speedMin: 0.018,  speedRange: 0.09,
    maxForce: 0.05,
    scaleMin: 0.07,   scaleRange: 0.015,
    flockWeight: 1.5,
    perceptionR: 90,
    fadeSpeedMin: 0.0004, fadeSpeedRange: 0.0007,
    rotationRange: 0.01,
    count: 60,
};

const MIDDLE_CFG = {
    // Fewer boids, moderate speed, less crowded
    speedMin: 0.009,  speedRange: 0.045,
    maxForce: 0.025,
    scaleMin: 0.07,   scaleRange: 0.045,
    flockWeight: 0.5,
    perceptionR: 120,
    fadeSpeedMin: 0.0003, fadeSpeedRange: 0.0006,
    rotationRange: 0.006,
    count: 10,
};

const FRONT_CFG = {
    // Very few, large, extremely slow – solitary drifters
    speedMin: 0.0007, speedRange: 0.004,
    maxForce: 0.005,
    scaleMin: 0.30,   scaleRange: 0.10,
    flockWeight: 0,
    perceptionR: 150,
    fadeSpeedMin: 0.0002, fadeSpeedRange: 0.0004,
    rotationRange: 0.002,
    count: 4,
};

// ─── Image Sources ───────────────────────────────────────────────────────────
const pad  = i => String(i).padStart(4, '0');
const BACK_SOURCES   = Array.from({length: 49}, (_, i) => `./back/Radiolarian${pad(i)}.png`);
const MIDDLE_SOURCES = Array.from({length: 49}, (_, i) => `./middle/Radiolarian${pad(i)}.png`);
const FRONT_SOURCES  = Array.from({length: 49}, (_, i) => `./front/Radiolarian${pad(i)}.png`);

// ─── Bootstrap: chain-load all three layers ──────────────────────────────────
loadImages(BACK_SOURCES, backImgs => {
    loadImages(MIDDLE_SOURCES, middleImgs => {
        loadImages(FRONT_SOURCES, frontImgs => {
            startAnimation(backImgs, middleImgs, frontImgs);
        });
    });
});

function startAnimation(backImgs, middleImgs, frontImgs) {
    if (middleImgs.length === 0) middleImgs = backImgs;
    if (frontImgs.length  === 0) frontImgs  = backImgs;

    // ── create all boids (inactive) ──
    const backLayer   = Array.from({length: BACK_CFG.count},   () => new Boid(backImgs,   BACK_CFG));
    const middleLayer = Array.from({length: MIDDLE_CFG.count}, () => new Boid(middleImgs, MIDDLE_CFG));
    const frontLayer  = Array.from({length: FRONT_CFG.count},  () => new Boid(frontImgs,  FRONT_CFG));

    // ── combine into a single list for spawning (front → middle → back) ──
    const allBoids = [...frontLayer, ...middleLayer, ...backLayer];

    // ── spawning parameters ──
    const SPAWN_INTERVAL = 2000;   // 2 seconds
    const BATCH_SIZE     = 2;      // 2 boids per batch
    let spawnIndex       = 0;
    let spawnAccumulator = 0;

    let lastFrameTime = 0;
    const frameInterval = 1000 / 30;

    // ── slow coordinated "breathing" zoom (depth parallax) ──
    // A single sine wave drives all three layers in sync (same phase =
    // "coordinated"), each scaled by its own amplitude so the front layer
    // (closer, so it should move more) zooms further than the back layer.
    // Sine naturally eases in/out at the peaks — smooth turnarounds for
    // free, no separate easing function needed. One very long cycle =
    // "VERY slow". This adds negligible cost: one Math.sin() per frame,
    // reused across every boid.
    const ZOOM_CYCLE_MS = 75000; // ~75s for a full zoom-in + zoom-out cycle
    const ZOOM_AMPLITUDE = { back: 0.03, middle: 0.09, front: 0.22 };

    let animationPaused = false;
    document.addEventListener('visibilitychange', () => {
        animationPaused = document.hidden;
        if (!animationPaused) {
            lastFrameTime = 0;
            requestAnimationFrame(animate);
        }
    });

    function animate(currentTime) {
        if (animationPaused) return; // resumes via visibilitychange listener

        if (currentTime - lastFrameTime < frameInterval) {
            requestAnimationFrame(animate);
            return;
        }
        const deltaMs = currentTime - lastFrameTime;
        lastFrameTime = currentTime;

        // ── spawn new boids if time is up ──
        spawnAccumulator += deltaMs;
        if (spawnAccumulator >= SPAWN_INTERVAL && spawnIndex < allBoids.length) {
            for (let i = 0; i < BATCH_SIZE && spawnIndex < allBoids.length; i++) {
                allBoids[spawnIndex].active = true;
                spawnIndex++;
            }
            spawnAccumulator -= SPAWN_INTERVAL;
        }

        // ── draw background (pre-rendered, just a blit) ──
        ctx.drawImage(bgCanvas, 0, 0);

        // ── shared breathing factor for this frame, -1..1 ──
        const breathe = Math.sin((currentTime / ZOOM_CYCLE_MS) * Math.PI * 2);
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const zoomBack   = 1 + ZOOM_AMPLITUDE.back   * breathe;
        const zoomMiddle = 1 + ZOOM_AMPLITUDE.middle * breathe;
        const zoomFront  = 1 + ZOOM_AMPLITUDE.front  * breathe;

        // ── update & draw each layer (painter's order) ──
        updateAndDrawLayer(backLayer,   zoomBack,   cx, cy);
        updateAndDrawLayer(middleLayer, zoomMiddle, cx, cy);
        updateAndDrawLayer(frontLayer,  zoomFront,  cx, cy);

        requestAnimationFrame(animate);
    }

    function updateAndDrawLayer(layer, zoom, cx, cy) {
        for (let i = 0; i < layer.length; i++) {
            const boid = layer[i];
            if (!boid.active) continue;
            if (i % 3 === 0) boid.flock(layer);
            boid.update();
        }
        for (let i = 0; i < layer.length; i++) {
            const boid = layer[i];
            if (boid.active) boid.draw(zoom, cx, cy);
        }
    }

    animate(0);
}

// ─── Resize ──────────────────────────────────────────────────────────────────
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        createOvalGradient();
        renderBackground();
    }, 150);
});