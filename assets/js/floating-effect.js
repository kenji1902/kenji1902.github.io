
export class FloatingEffect {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.particles = [];
        this.config = config || {};

        // Slider State
        this.sliderPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.isMobile = window.innerWidth <= 768;
        this.lastPos = 0;
        this.velocity = 0;
        this.spawnAccumulator = 0;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Listen to custom slider event from app.js
        window.addEventListener('sliderMove', (e) => {
            const { x, y, isMobile } = e.detail;
            this.isMobile = isMobile;

            const currentPos = isMobile ? y : x;
            const delta = currentPos - this.lastPos;
            this.velocity = Math.abs(delta);
            this.lastPos = currentPos;

            this.sliderPos = { x, y };

            // Spawn Particles based on movement
            // Accumulate "partial" particles to handle low-velocity (smooth) drags
            const sensitivity = this.isMobile ? 1.5 : 0.8;
            this.spawnAccumulator += this.velocity * sensitivity;

            // Limit max burst per frame to avoid lag on huge jumps
            if (this.spawnAccumulator > 20) this.spawnAccumulator = 20;

            while (this.spawnAccumulator >= 1) {
                this.spawnParticles(1, this.velocity, delta);
                this.spawnAccumulator -= 1;
            }
        });

        this.animate();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.isMobile = this.width <= 768;
        // Reset slider center if not yet set
        if (!this.lastPos) {
            this.lastPos = this.isMobile ? this.height / 2 : this.width / 2;
        }
    }

    spawnParticles(count, velocity, delta) {
        // Count passed from accumulator loop

        // Determine theme based on direction
        // Desktop: Right (Delta > 0) = Expanding Dev = Dev Theme
        // Mobile: User feedback implies inversion or specific feel
        // Let's try: Mobile Down (Delta > 0) = Creative? Up (Delta < 0) = Dev?
        // OR just strict logic: 
        // If the user says "Show dev side... show dev particles", and dragging down reveals dev...
        // Maybe they want the particles to represent the side being COVERED? or the side being REVEALED?
        // Let's assume on Mobile, Dragging Down (Delta > 0) feels like "Pulling Creative Down".
        // Let's flip it.

        // Determine theme based on direction
        // Desktop: Right (Delta > 0) = Reveals Developer
        // Mobile: Down (Delta > 0) = Reveals Developer
        // User confirmed: Dragging UP (Delta < 0) -> Creative.
        // Therefore: Dragging DOWN (Delta > 0) -> Developer.
        const isDevTheme = delta > 0;

        for (let i = 0; i < count; i++) {
            let x, y;

            if (this.isMobile) {
                // Horizontal Spread along the vertical line
                x = Math.random() * this.width;
                y = this.sliderPos.y + (Math.random() - 0.5) * 10;
            } else {
                // Vertical Spread along the horizontal line
                x = this.sliderPos.x + (Math.random() - 0.5) * 10;
                y = Math.random() * this.height;
            }

            if (isDevTheme) {
                const conf = this.config.developer || {};
                const color = this.getRandomColor(conf.colors || ['#00ff9d']);
                this.particles.push(new BinaryParticle(x, y, color, velocity, conf.chars || "01"));
            } else {
                const conf = this.config.creative || {};
                const color = this.getRandomColor(conf.colors || ['#ff0055']);
                this.particles.push(new SparkleParticle(x, y, color, velocity));
            }
        }
    }

    getRandomColor(colors) {
        return colors[Math.floor(Math.random() * colors.length)];
    }

    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update and Draw Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            p.draw(this.ctx);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Draw Slider Line Glow (Optional, to enhance the effect)
        // this.drawGlow();

        requestAnimationFrame(() => this.animate());
    }

    drawGlow() {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        // Create a faint line at the slider position
        if (this.isMobile) {
            const grad = this.ctx.createLinearGradient(0, this.sliderPos.y - 2, 0, this.sliderPos.y + 2);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)'); // Very subtle
            grad.addColorStop(1, 'transparent');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, this.sliderPos.y - 20, this.width, 40);
        } else {
            const grad = this.ctx.createLinearGradient(this.sliderPos.x - 2, 0, this.sliderPos.x + 2, 0);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
            grad.addColorStop(1, 'transparent');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(this.sliderPos.x - 20, 0, 40, this.height);
        }
        this.ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, velocity) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;

        // Random drift direction
        const angle = Math.random() * Math.PI * 2;
        // Velocity adds energy
        const speed = Math.random() * (velocity * 0.1) + 1;

        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw(ctx) {
        // Base draw (override)
    }
}

class SparkleParticle extends Particle {
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BinaryParticle extends Particle {
    constructor(x, y, color, velocity, chars) {
        super(x, y, color, velocity);
        this.char = chars[Math.floor(Math.random() * chars.length)];
        this.fontSize = Math.floor(this.size * 4) + 10; // Make them legible
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.fontSize}px monospace`;
        ctx.fillText(this.char, this.x, this.y);
        ctx.restore();
    }
}
