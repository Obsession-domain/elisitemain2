const canvas = document.getElementById('boidsCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
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
        this.flockWeight  = cfg.flockWeight;  // 0 = solo drifter, 1 = full flocking
        this.perceptionR  = cfg.perceptionR;

        this.opacity      = 0;
        this.fadeState    = 'in';
        this.fadeSpeed    = cfg.fadeSpeedMin + Math.random() * cfg.fadeSpeedRange;
        this.rotation     = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * cfg.rotationRange;
    }

    edges() {
        const margin = 50;
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

    steer(boids, mode) {
        const r      = mode === 'separation' ? this.perceptionR * 0.55 : this.perceptionR;
        let steering = new Vector();
        let total    = 0;
        const maxCheck = Math.min(25, boids.length);
        for (let i = 0; i < maxCheck; i++) {
            const other = boids[Math.floor(Math.random() * boids.length)];
            const d     = this.position.distance(other.position);
            if (other !== this && d < r) {
                if (mode === 'align')      steering.add(other.velocity);
                if (mode === 'cohesion')   steering.add(other.position);
                if (mode === 'separation') {
                    const diff = Vector.subtract(this.position, other.position);
                    diff.divide(d * d);
                    steering.add(diff);
                }
                total++;
            }
        }
        if (total > 0) {
            steering.divide(total);
            if (mode === 'cohesion') steering.subtract(this.position);
            steering.normalize();
            steering.multiply(this.maxSpeed);
            steering.subtract(this.velocity);
            steering.limit(this.maxForce);
        }
        return steering;
    }

    flock(boids) {
        if (this.flockWeight === 0) return;
        const a = this.steer(boids, 'align');
        const c = this.steer(boids, 'cohesion');
        const s = this.steer(boids, 'separation');
        a.multiply(this.flockWeight);
        c.multiply(this.flockWeight);
        s.multiply(this.flockWeight);
        this.acceleration.add(a);
        this.acceleration.add(c);
        this.acceleration.add(s);
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

    draw() {
        if (!this.image || this.image.width === 0) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        const w = this.image.width  * this.scale;
        const h = this.image.height * this.scale;
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        ctx.drawImage(this.image, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
}

// ─── Layer Configs ───────────────────────────────────────────────────────────

const BACK_CFG = {
    // Small, slow, tight flocking — distant background organisms
    speedMin: 0.01,   speedRange: 0.15,
    maxForce: 0.08,
    scaleMin: 0.08,   scaleRange: 0.08,
    flockWeight: 1.0,
    perceptionR: 90,
    fadeSpeedMin: 0.008, fadeSpeedRange: 0.015,
    rotationRange: 0.004,
    count: 80,
};

const MIDDLE_CFG = {
    // Medium scale, moderate speed, loose flocking
    speedMin: 0.05,   speedRange: 0.25,
    maxForce: 0.06,
    scaleMin: 0.18,   scaleRange: 0.12,
    flockWeight: 0.5,
    perceptionR: 120,
    fadeSpeedMin: 0.006, fadeSpeedRange: 0.012,
    rotationRange: 0.006,
    count: 40,
};

const FRONT_CFG = {
    // Large, very slow, pure independent drifters — no flocking
    speedMin: 0.005,  speedRange: 0.04,
    maxForce: 0.02,
    scaleMin: 0.35,   scaleRange: 0.20,
    flockWeight: 0,   // fully independent
    perceptionR: 150,
    fadeSpeedMin: 0.003, fadeSpeedRange: 0.006,
    rotationRange: 0.002,
    count: 15,
};

// ─── Image Sources ───────────────────────────────────────────────────────────
// Each folder may have up to 49 images (0000–0048); missing ones are skipped via onerror
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
    // If a folder is empty/missing, fall back to the back layer images
    if (middleImgs.length === 0) middleImgs = backImgs;
    if (frontImgs.length  === 0) frontImgs  = backImgs;

    const backLayer   = Array.from({length: BACK_CFG.count},   () => new Boid(backImgs,   BACK_CFG));
    const middleLayer = Array.from({length: MIDDLE_CFG.count},  () => new Boid(middleImgs, MIDDLE_CFG));
    const frontLayer  = Array.from({length: FRONT_CFG.count},   () => new Boid(frontImgs,  FRONT_CFG));

    let lastFrameTime = 0;
    const frameInterval = 1000 / 30;

    function animate(currentTime) {
        if (currentTime - lastFrameTime < frameInterval) {
            requestAnimationFrame(animate);
            return;
        }
        lastFrameTime = currentTime;

        // Draw background
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = ovalGradient;
        ctx.beginPath();
        ctx.ellipse(canvas.width/2, canvas.height/2, canvas.width*0.9, canvas.height*0.9, 0, 0, Math.PI*2);
        ctx.fill();

        // Update & draw back → middle → front (painter's order)
        [backLayer, middleLayer, frontLayer].forEach(layer => {
            for (let i = 0; i < layer.length; i++) {
                if (i % 3 === 0) layer[i].flock(layer); // flock only within own layer
                layer[i].update();
            }
            for (let i = 0; i < layer.length; i++) layer[i].draw();
        });

        requestAnimationFrame(animate);
    }

    animate(0);
}

// ─── Resize ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    createOvalGradient();
});