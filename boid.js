const canvas = document.getElementById('boidsCanvas');
const ctx = canvas.getContext('2d');
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
        this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
        this.velocity = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        this.acceleration = new Vector();
        this.maxSpeed = .01 + Math.random() * 0.2;
        this.maxForce = 0.1;
        this.image = imageArray[Math.floor(Math.random() * imageArray.length)];
        this.radius = 1000;
        this.scale = Math.random() * 0.1 + 0.01; // Random scale between 0.5 and 1.0
    }
    

    edges() {
        if (this.position.x > canvas.width) this.position.x = 0;
        if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.y > canvas.height) this.position.y = 0;
        if (this.position.y < 0) this.position.y = canvas.height;
    }

    align(boids) {
        let perceptionRadius = 90;
        let steering = new Vector();
        let total = 0;
        for (let other of boids) {
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
        for (let other of boids) {
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
        let perceptionRadius = 50; // Adjusted for more effective separation
        let steering = new Vector();
        let total = 0;
        for (let other of boids) {
            let d = this.position.distance(other.position);
            if (other !== this && d < perceptionRadius) {
                let diff = Vector.subtract(this.position, other.position);
                diff.divide(d * d); // Repel more strongly at shorter distances
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

    update() {
        this.position.add(this.velocity);
        this.velocity.add(this.acceleration);
        this.velocity.limit(this.maxSpeed);
        this.acceleration.multiply(0); // Reset acceleration each frame
        this.edges();
    }

    draw() {
        
        const scaledWidth = this.image.width * this.scale;
        const scaledHeight = this.image.height * this.scale;
        ctx.drawImage(
            this.image,
            this.position.x - scaledWidth / 8, // Center the scaled image
            this.position.y - scaledHeight / 8,
            scaledWidth,
            scaledHeight
        );
        ctx.save();
        ctx.filter = `blur(${this.blur}px)`;
        ctx.restore();


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
        super(imageArray); // Ensure Predator also receives images
        this.maxSpeed += 0.1; // Predators are faster
        this.image = imageArray[Math.floor(Math.random() * imageArray.length)]; // Ensure predators have an image
        this.radius = 9; // Slightly larger
    }

    // Predator specific methods can go here
}

loadImages(['D1.png', 'D2.png', 'D3.png', 'D5.png','D105.png','D205.png','D305.png'], (loadedImages) => {
    const flock = Array.from({length: 3}, () => new Boid(loadedImages));
    const predators = Array.from({length: 500}, () => new Predator(loadedImages));

    function animate() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flock.forEach(boid => {
            boid.flock(flock);
            boid.update();
            boid.draw();
        });
        predators.forEach(predator => {
            predator.flock(flock); // Here, predators interact with the flock
            predator.update();
            predator.draw();
        });
        requestAnimationFrame(animate);
    }

    animate();
});

window.addEventListener('resize', function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});