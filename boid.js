const canvas = document.getElementById('boidsCanvas');
// Basic context without advanced options for better performance
const ctx = canvas.getContext('2d', { alpha: true });

// Set minimal image smoothing - only if really needed
ctx.imageSmoothingEnabled = false; // Disable for better performance
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const images = [];
const loadImages = (sources, callback) => {
    let loadedImages = 0;
    sources.forEach(source => {
        const img = new Image();
        img.onload = () => {
            if (++loadedImages >= sources.length) {
                callback(images);
            }
        };
        img.src = source;
        images.push(img);
    });
};

class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    static subtract(v1, v2) {
        return new Vector(v1.x - v2.x, v1.y - v2.y);
    }

    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
    }

    subtract(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
    }

    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
    }

    divide(scalar) {
        this.x /= scalar;
        this.y /= scalar;
    }

    magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    normalize() {
        const mag = this.magnitude();
        if (mag > 0) {
            this.divide(mag);
        }
    }

    limit(max) {
        if (this.magnitude() > max) {
            this.normalize();
            this.multiply(max);
        }
    }

    distance(vector) {
        const dx = this.x - vector.x, dy = this.y - vector.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

class Boid {
    constructor(imageArray) {
        // Generate a random spawn position
        this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
        this.velocity = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        this.acceleration = new Vector();
        this.maxSpeed = .01 + Math.random() * 0.2;
        this.maxForce = 0.1;
        this.image = imageArray[Math.floor(Math.random() * imageArray.length)];
        this.radius = 1000;
        this.scale = Math.random() * 0.05 + 0.005;
        
        // Add opacity property for fading
        this.opacity = 0; // Start fully transparent
        this.fadeState = 'in'; // States: 'in', 'visible', 'out'
        this.fadeSpeed = 0.01 + Math.random() * 0.02; // Random fade speed
    }
    
    edges() {
        // Start fade out when close to an edge
        const margin = 50; // Margin to start fading
        
        if (this.fadeState === 'visible') {
            if (this.position.x > canvas.width - margin || 
                this.position.x < margin || 
                this.position.y > canvas.height - margin || 
                this.position.y < margin) {
                this.fadeState = 'out';
            }
        }
        
        // Teleport to the opposite side when fully invisible
        if (this.opacity <= 0 && this.fadeState === 'out') {
            if (this.position.x > canvas.width) this.position.x = 0;
            if (this.position.x < 0) this.position.x = canvas.width;
            if (this.position.y > canvas.height) this.position.y = 0;
            if (this.position.y < 0) this.position.y = canvas.height;
            this.fadeState = 'in'; // Start fading in again
        }
    }

    align(boids) {
        let perceptionRadius = 90;
        let steering = new Vector();
        let total = 0;
        // Process only a subset of boids for performance
        const maxCheck = Math.min(25, boids.length);
        for (let i = 0; i < maxCheck; i++) {
            const other = boids[Math.floor(Math.random() * boids.length)];
            let d = this.position.distance(other.position);
            if (other !== this && d < perceptionRadius) {
                steering.add(other.velocity);
                total++;
            }
        }
        if (total > 0) {
            steering.divide(total);
            steering.normalize();
            steering.multiply(this.maxSpeed);
            steering.subtract(this.velocity);
            steering.limit(this.maxForce);
        }
        return steering;
    }

    cohesion(boids) {
        let perceptionRadius = 90;
        let steering = new Vector();
        let total = 0;
        // Process only a subset of boids for performance
        const maxCheck = Math.min(25, boids.length);
        for (let i = 0; i < maxCheck; i++) {
            const other = boids[Math.floor(Math.random() * boids.length)];
            let d = this.position.distance(other.position);
            if (other !== this && d < perceptionRadius) {
                steering.add(other.position);
                total++;
            }
        }
        if (total > 0) {
            steering.divide(total);
            steering.subtract(this.position);
            steering.normalize();
            steering.multiply(this.maxSpeed);
            steering.subtract(this.velocity);
            steering.limit(this.maxForce);
        }
        return steering;
    }

    separation(boids) {
        let perceptionRadius = 50;
        let steering = new Vector();
        let total = 0;
        // Process only a subset of boids for performance
        const maxCheck = Math.min(25, boids.length);
        for (let i = 0; i < maxCheck; i++) {
            const other = boids[Math.floor(Math.random() * boids.length)];
            let d = this.position.distance(other.position);
            if (other !== this && d < perceptionRadius) {
                let diff = Vector.subtract(this.position, other.position);
                diff.divide(d * d);
                steering.add(diff);
                total++;
            }
        }
        if (total > 0) {
            steering.divide(total);
            steering.normalize();
            steering.multiply(this.maxSpeed);
            steering.subtract(this.velocity);
            steering.limit(this.maxForce);
        }
        return steering;
    }

    updateFade() {
        // Handle fading in or out
        if (this.fadeState === 'in' && this.opacity < 1) {
            this.opacity += this.fadeSpeed;
            if (this.opacity >= 1) {
                this.opacity = 1;
                this.fadeState = 'visible';
            }
        } else if (this.fadeState === 'out' && this.opacity > 0) {
            this.opacity -= this.fadeSpeed;
            if (this.opacity <= 0) {
                this.opacity = 0;
            }
        }
    }

    update() {
        this.position.add(this.velocity);
        this.velocity.add(this.acceleration);
        this.velocity.limit(this.maxSpeed);
        this.acceleration.multiply(0);
        this.updateFade(); // Update opacity based on fade state
        this.edges();
    }

    draw() {
        // Apply the current opacity
        ctx.globalAlpha = this.opacity;
        
        // Skip filters for better performance, use simple coloring
        // More efficient than using CSS filters
        const scaledWidth = this.image.width * this.scale;
        const scaledHeight = this.image.height * this.scale;
        
        // Don't round positions - can be performance intensive
        const x = this.position.x - scaledWidth / 8;
        const y = this.position.y - scaledHeight / 8;
        
        ctx.drawImage(
            this.image,
            x,
            y,
            scaledWidth,
            scaledHeight
        );
        
        // Reset opacity for the next drawings
        ctx.globalAlpha = 1.0;
    }

    flock(boids) {
        let alignment = this.align(boids);
        let cohesion = this.cohesion(boids);
        let separation = this.separation(boids);
        this.acceleration.add(alignment);
        this.acceleration.add(cohesion);
        this.acceleration.add(separation);
    }
}

class Predator extends Boid {
    constructor(imageArray) {
        super(imageArray);
        this.maxSpeed += 0.1;
        this.image = imageArray[Math.floor(Math.random() * imageArray.length)];
        this.radius = 9;
        // Predators can have different fade speeds if desired
        this.fadeSpeed = 0.0001 + Math.random() * 0.025; // Slightly faster fade for predators
    }
}

loadImages(['./Algae/Algae1.png','./Algae/Algae2.png','./Algae/Algae3.png','./Algae/Algae4.png','./Algae/Algae5.png','./Algae/Algae6.png','./Algae/Algae7.png','./Algae/Algae8.png','./Algae/Algae9.png','./Algae/Algae10.png','./Algae/Algae11.png','./Algae/Algae12.png','./Algae/Algae13.png','./Algae/Algae14.png','./Algae/Algae15.png','./Algae/Algae16.png','./Algae/Algae17.png','./Algae/Algae18.png','./Algae/Algae19.png','./Algae/Algae20.png','./Algae/Algae21.png','./Algae/Algae22.png','./Algae/Algae23.png','./Algae/Algae24.png','./Algae/Algae25.png','./Algae/Algae26.png','./Algae/Algae27.png','./Algae/Algae28.png'], (loadedImages) => {
    // Reduce the number of entities
    const flock = Array.from({length: 3}, () => new Boid(loadedImages));
    const predators = Array.from({length: 100}, () => new Predator(loadedImages));

    // Use a lower frame rate for animation
    let lastFrameTime = 0;
    const frameInterval = 1000/30; // Aim for 30 FPS instead of 60+

    function animate(currentTime) {
        // Skip frames to maintain target framerate
        if (currentTime - lastFrameTime < frameInterval) {
            requestAnimationFrame(animate);
            return;
        }
        lastFrameTime = currentTime;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Process entities in batches for better performance
        const allEntities = [...flock, ...predators];
        
        // Update physics first
        for (let i = 0; i < allEntities.length; i++) {
            const entity = allEntities[i];
            
            // Simplified flocking - don't check ALL boids every frame
            if (i % 3 === 0) { // Only process 1/3 of interactions per frame
                entity.flock(allEntities);
            }
            
            entity.update();
        }
        
        // Then handle rendering
        for (let i = 0; i < allEntities.length; i++) {
            allEntities[i].draw();
        }
        
        requestAnimationFrame(animate);
    }

    animate(0);
});

window.addEventListener('resize', function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});