const canvas = document.getElementById('boidsCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

// ─── Background Gradients ────────────────────────────────────────────────────
const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
gradient.addColorStop(0,   'rgb(19, 20, 20)');
gradient.addColorStop(0.2, 'rgb(0, 0, 0)');
gradient.addColorStop(0.9, 'rgb(0, 0, 0)');
gradient.addColorStop(1,   'rgb(27, 28, 24)');

let ovalGradient;
function createOvalGradient() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const rx = canvas.width * 0.6, ry = canvas.height * 0.35;
    ovalGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    ovalGradient.addColorStop(0,   'rgba(7, 8, 8, 0.88)');
    ovalGradient.addColorStop(0.7, 'rgba(6, 2, 32, 0.07)');
    ovalGradient.addColorStop(1,   'rgba(0, 0, 0, 0)');
}
createOvalGradient();

// Background rendered once into an offscreen canvas
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

// ─── Image Cache (lazy loading) ─────────────────────────────────────────────
const imageCache = {
    cache: new Map(),          // url -> Image
    loading: new Map(),        // url -> Promise
    get(url) {
        if (this.cache.has(url)) return Promise.resolve(this.cache.get(url));
        if (this.loading.has(url)) return this.loading.get(url);
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.cache.set(url, img);
                this.loading.delete(url);
                resolve(img);
            };
            img.onerror = () => {
                this.loading.delete(url);
                reject(new Error(`Failed to load: ${url}`));
            };
            img.src = url;
        });
        this.loading.set(url, promise);
        return promise;
    }
};

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
    constructor(sourceArray, cfg) {
        this.position     = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
        this.velocity     = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        this.acceleration = new Vector();

        // Lazy loading: store the image source URL instead of an Image object
        this.imageSrc     = sourceArray[Math.floor(Math.random() * sourceArray.length)];
        this.image        = null;        // will be set when loaded
        this.imageLoaded  = false;
        this.loading      = false;

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
this.firstSpawn = true;

        this.active = false;
    }

    edges() {
        const margin = 200;
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

    _applySteer(sx, sy, weight) {
        let mag = Math.sqrt(sx * sx + sy * sy);
        if (mag === 0) return;
        sx = (sx / mag) * this.maxSpeed;
        sy = (sy / mag) * this.maxSpeed;
        sx -= this.velocity.x;
        sy -= this.velocity.y;
        mag = Math.sqrt(sx * sx + sy * sy);
        if (mag > this.maxForce) {
            sx = (sx / mag) * this.maxForce;
            sy = (sy / mag) * this.maxForce;
        }
        this.acceleration.x += sx * weight;
        this.acceleration.y += sy * weight;
    }

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
        if (this.fadeState === 'in') {
    const speed = this.firstSpawn ? this.fadeSpeed * 5 : this.fadeSpeed;
    this.opacity += speed;
    if (this.opacity >= 1) {
        this.opacity = 1;
        this.fadeState = 'visible';
        this.firstSpawn = false;   // only once
    }
} else if (this.fadeState === 'out') {
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

    draw(zoom = 1, cx = 0, cy = 0) {
    if (!this.active || this.opacity <= 0 || this.loadFailed) return;

    // If image not loaded yet, trigger a load
    if (!this.imageLoaded && !this.loading) {
        this.loading = true;
        imageCache.get(this.imageSrc)
            .then(img => {
                this.image = img;
                this.imageLoaded = true;
                this.loading = false;
            })
            .catch(() => {
                // On failure, mark as failed and stop retrying
                this.loadFailed = true;
                this.loading = false;
                // Do NOT set imageLoaded – we check loadFailed first.
            });
    }

    // If still not loaded (and not failed), draw a placeholder
    if (!this.imageLoaded) {
        ctx.globalAlpha = this.opacity;
        const size = 24 * this.scale * zoom;
        ctx.setTransform(1, 0, 0, 1, this.position.x * zoom + cx * (1 - zoom), this.position.y * zoom + cy * (1 - zoom));
        ctx.fillStyle = 'rgba(180, 180, 180, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        return;
    }

    // Image is ready – draw it
    const px = zoom * this.position.x + cx * (1 - zoom);
    const py = zoom * this.position.y + cy * (1 - zoom);
    const w = this.image.width  * this.scale * zoom;
    const h = this.image.height * this.scale * zoom;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    ctx.globalAlpha = this.opacity;
    ctx.setTransform(cos, sin, -sin, cos, px, py);
    ctx.drawImage(this.image, -w / 2, -h / 2, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
}
}

// ─── Layer Configs ───────────────────────────────────────────────────────────
// Mobile devices generally have weaker GPUs and this canvas is purely
// decorative, so it runs fewer boids there — cheaper to update, flock,
// and draw every frame, with barely any visible difference in a
// background element on a small screen.
const IS_MOBILE = window.innerWidth < 768;
const MOBILE_COUNT_SCALE = 0.5;

const BACK_CFG = {
     speedMin: 0.0007, speedRange: 0.004,
    maxForce: 0.0005,
    scaleMin: 0.50,   scaleRange: 0.05,
    flockWeight: 0,
    perceptionR: 150,
    fadeSpeedMin: 0.0002, fadeSpeedRange: 0.0004,
    rotationRange: 0.002,
    count: IS_MOBILE ? Math.max(7, Math.round(4 * MOBILE_COUNT_SCALE)) : 9,
};

const MIDDLE_CFG = {
    speedMin: 0.006,  speedRange: 0.045,
    maxForce: 0.005,
    scaleMin: 0.15,   scaleRange: 0.045,
    flockWeight: 0.5,
    perceptionR: 120,
    fadeSpeedMin: 0.0003, fadeSpeedRange: 0.0006,
    rotationRange: 0.003,
    count: IS_MOBILE ? Math.round(60 * MOBILE_COUNT_SCALE) : 60,
};

const FRONT_CFG = {
   speedMin: 0.01,  speedRange: 0.09,
    maxForce: 0.05,
    scaleMin: 0.05,   scaleRange: 0.15,
    flockWeight: 1.5,
    perceptionR: 90,
    fadeSpeedMin: 0.0004, fadeSpeedRange: 0.0007,
    rotationRange: 0.005,
    count: IS_MOBILE ? Math.round(40 * MOBILE_COUNT_SCALE) : 30,
};

// ─── Image Sources ───────────────────────────────────────────────────────────
const pad  = i => String(i).padStart(4, '0');
const BACK_SOURCES   = Array.from({length: 49}, (_, i) => `./back/Radiolarian${pad(i)}.webp`);
const MIDDLE_SOURCES = Array.from({length: 49}, (_, i) => `./middle/Radiolarian${pad(i)}.webp`);
const FRONT_SOURCES  = Array.from({length: 49}, (_, i) => `./front/Radiolarian${pad(i)}.webp`);

// ─── Start Animation (no preloading) ────────────────────────────────────────
startAnimation(BACK_SOURCES, MIDDLE_SOURCES, FRONT_SOURCES);

function startAnimation(backSources, middleSources, frontSources) {
    // ── create all boids (inactive) – each picks a source URL ──
    const backLayer   = Array.from({length: BACK_CFG.count},   () => new Boid(backSources,   BACK_CFG));
    const middleLayer = Array.from({length: MIDDLE_CFG.count}, () => new Boid(middleSources, MIDDLE_CFG));
    const frontLayer  = Array.from({length: FRONT_CFG.count},  () => new Boid(frontSources,  FRONT_CFG));

    const allBoids = [...frontLayer, ...middleLayer, ...backLayer];

    const SPAWN_INTERVAL = 1;
    const BATCH_SIZE     = 2;
    let spawnIndex       = 0;
    let spawnAccumulator = 0;

    let lastFrameTime = 0;
    const frameInterval = 1000 / (IS_MOBILE ? 24 : 30);

    const ZOOM_CYCLE_MS = 7500000;
    const ZOOM_AMPLITUDE = { back: 0.03, middle: 0.15, front: 0.2 };

    let animationPaused = false;
    document.addEventListener('visibilitychange', () => {
        animationPaused = document.hidden;
        if (!animationPaused) {
            lastFrameTime = 0;
            requestAnimationFrame(animate);
        }
    });

    function animate(currentTime) {
        if (animationPaused) return;

        if (currentTime - lastFrameTime < frameInterval) {
            requestAnimationFrame(animate);
            return;
        }
        const deltaMs = currentTime - lastFrameTime;
        lastFrameTime = currentTime;

        // spawn new boids
        spawnAccumulator += deltaMs;
        if (spawnAccumulator >= SPAWN_INTERVAL && spawnIndex < allBoids.length) {
            for (let i = 0; i < BATCH_SIZE && spawnIndex < allBoids.length; i++) {
                allBoids[spawnIndex].active = true;
                spawnIndex++;
            }
            spawnAccumulator -= SPAWN_INTERVAL;
        }

        // draw background
        ctx.drawImage(bgCanvas, 0, 0);

        const breathe = Math.sin((currentTime / ZOOM_CYCLE_MS) * Math.PI * 2);
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const zoomBack   = 1 + ZOOM_AMPLITUDE.back   * breathe;
        const zoomMiddle = 1 + ZOOM_AMPLITUDE.middle * breathe;
        const zoomFront  = 1 + ZOOM_AMPLITUDE.front  * breathe;

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