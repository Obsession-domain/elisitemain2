let mouseX = -1000; // Start off-screen
let mouseY = -1000;

const canvas = document.getElementById('boidsCanvas');
// Basic context without advanced options for better performance
const ctx = canvas.getContext('2d', { alpha: true });

// Set minimal image smoothing - only if really needed
ctx.imageSmoothingEnabled = false; // Disable for better performance
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  
  canvas.addEventListener('mouseout', () => {
    mouseX = -1000; // Reset to off-screen when mouse leaves
    mouseY = -1000;
  });
// Create gradient (horizontal)
const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

// Add color stops
gradient.addColorStop(0, 'rgb(0, 0, 0)'); // Start with black
gradient.addColorStop(0.2, 'rgb(20, 47, 32)'); // Start with black

gradient.addColorStop(0.9, 'rgb(97, 88, 88)'); // Start with black
gradient.addColorStop(1, 'rgb(112, 121, 149)'); // End with dark gray



// Create a background gradient - initialized in the resize handler
let ovalGradient;

// Function to create the oval gradient background
function createOvalGradient() {
    // Create a radial gradient for the oval
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Make the oval about 70% of the screen width and height
    const radiusX = canvas.width * 0.6;
    const radiusY = canvas.height * 0.35;
    

    // Create a gradient from center to the edges
    ovalGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, Math.max(radiusX, radiusY)
    );
    
    // Add color stops for the gradient
    ovalGradient.addColorStop(0, 'rgba(129, 140, 150, 0.57)');  // Light grey center
    ovalGradient.addColorStop(0.7, 'rgba(83, 82, 86, 0.23)');   // Mid grey
    ovalGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');         // Fade to transparent
}

// Initialize the gradient
createOvalGradient();

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
        this.maxSpeed = 9 + Math.random() * 0.2;
        this.maxForce = 9;
        this.image = imageArray[Math.floor(Math.random() * imageArray.length)];
        this.radius = 1000;
        this.scale = Math.random() * 0.1 + 0.00005;
        
        // Add opacity property for fading
        this.opacity = 0; // Start fully transparent
        this.fadeState = 'in'; // States: 'in', 'visible', 'out'
        this.fadeSpeed = 0.01 + Math.random() * 0.02; // Random fade speed
        
        // Add rotation properties
        this.rotation = Math.random() * Math.PI * 2; // Initial random rotation in radians
        this.rotationSpeed = (Math.random() - 0.005) * 0.003; // Random rotation speed (-0.015 to 0.015 radians per frame)
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
        let perceptionRadius = 900;
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

    avoidCursor() {
        const avoidanceRadius = 10;
        const mousePos = new Vector(mouseX, mouseY);
        const distance = this.position.distance(mousePos);
        
        if (distance < avoidanceRadius) {
            let steer = Vector.subtract(this.position, mousePos);
            const distanceFactor = 1 - (distance / avoidanceRadius);
            steer.normalize();
            steer.multiply(this.maxSpeed * 200 * distanceFactor);
            steer.subtract(this.velocity);
            steer.limit(this.maxForce * 300);
            return steer;
        }
        return new Vector();
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
        
        // Update rotation
        this.rotation += this.rotationSpeed;
        // Keep rotation within 0 to 2π range (optional)
        if (this.rotation > Math.PI * 2) this.rotation -= Math.PI * 2;
        if (this.rotation < 0) this.rotation += Math.PI * 2;
        
        this.edges();
    }

    draw() {
        // Save the current context state
        ctx.save();
        
        // Apply the current opacity
        ctx.globalAlpha = this.opacity; 
        
        // Calculate the center for rotation
        const scaledWidth = this.image.width * this.scale;
        const scaledHeight = this.image.height * this.scale;
        const centerX = this.position.x;
        const centerY = this.position.y;
        
        // Translate to center point, rotate, then draw
        ctx.translate(centerX, centerY);
        ctx.rotate(this.rotation);
        
        // Draw image centered on the rotation point
        ctx.drawImage(
            this.image,
            -scaledWidth / 2,
            -scaledHeight / 2,
            scaledWidth,
            scaledHeight
        );
        
        // Restore the context to its original state
        ctx.restore();
    }

    flock(boids) {
        let alignment = this.align(boids);
        let cohesion = this.cohesion(boids);
        let separation = this.separation(boids);
        let cursorAvoidance = this.avoidCursor(); // Add new avoidance force
        
        this.acceleration.add(alignment);
        this.acceleration.add(cohesion);
        this.acceleration.add(separation);
        this.acceleration.add(cursorAvoidance); // Add to acceleration
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
        
        // Predators might rotate differently
        this.rotationSpeed = (Math.random() - 0.0005) * 0.005; // Slightly faster rotation for predators
    }
}

loadImages(['./Algae/Algae1.png', './Algae/Algae2.png','./Algae/Algae3.png','./Algae/Algae4.png','./Algae/Algae5.png','./Algae/Algae6.png','./Algae/Algae7.png','./Algae/Algae8.png','./Algae/Algae9.png','./Algae/Algae10.png','./Algae/Algae11.png','./Algae/Algae12.png','./Algae/Algae13.png','./Algae/Algae14.png','./Algae/Algae15.png','./Algae/Algae16.png','./Algae/Algae17.png','./Algae/Algae18.png','./Algae/Algae19.png','./Algae/Algae20.png','./Algae/Algae21.png','./Algae/Algae22.png','./Algae/Algae23.png','./Algae/Algae24.png','./Algae/Algae25.png','./Algae/Algae26.png','./Algae/Algae27.png','./Algae/Algae28.png'], (loadedImages) => {
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
        
        // First draw a pure black background
        // Apply gradient
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, canvas.width, canvas.height);

        
        // Then draw the blurred grey oval in the center
        ctx.fillStyle = ovalGradient;
        
        // Draw an oval with blur effect
        ctx.beginPath();
        
        // Calculate oval dimensions - center of canvas
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radiusX = canvas.width * 0.9;
        const radiusY = canvas.height * 0.9;
        
        // Draw an ellipse
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        
    
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
    
    // Recreate the gradient when window is resized
    createOvalGradient();
});