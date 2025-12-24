
export class Particle {
    constructor(effect, x, y, color) {
        this.effect = effect;
        this.x = Math.random() * this.effect.width;
        this.y = Math.random() * this.effect.height;
        this.originX = x; // Target position (from image)
        this.originY = y;
        this.color = color;
        this.size = this.effect.gap;
        this.vx = 0;
        this.vy = 0;
        this.ease = this.effect.config.ease || 0.1;
        this.friction = this.effect.config.friction || 0.9;
        this.dx = 0;
        this.dy = 0;
        this.distance = 0;
        this.force = 0;
        this.angle = 0;
    }

    update() {
        this.dx = this.effect.mouse.x - this.x;
        this.dy = this.effect.mouse.y - this.y;
        this.distance = this.dx * this.dx + this.dy * this.dy;
        // Mouse interaction
        // Force Radius squared
        const forceRadius = 8000;

        if (this.distance < forceRadius) {
            this.force = -this.effect.config.mouseForce / this.distance;
            this.angle = Math.atan2(this.dy, this.dx);
            this.vx += this.force * Math.cos(this.angle);
            this.vy += this.force * Math.sin(this.angle);
        }

        // Return to origin
        this.x += (this.vx *= this.friction) + (this.originX - this.x) * this.ease;
        this.y += (this.vy *= this.friction) + (this.originY - this.y) * this.ease;
    }
}

export class MatrixParticle extends Particle {
    constructor(effect, x, y, color, char) {
        super(effect, x, y, color);
        this.char = char;
        this.fontSize = this.effect.gap * 1.5;
        this.timer = 0;
        this.interval = Math.floor(Math.random() * 20 + 10); // Random switch speed
    }

    update() {
        super.update();
        if (this.timer++ > this.interval) {
            this.timer = 0;
            // Switch char
            const charSet = this.effect.config.charSet || "01";
            this.char = charSet[Math.floor(Math.random() * charSet.length)];
        }
    }

    draw(context) {
        context.fillStyle = this.color;
        context.font = `${this.fontSize}px monospace`;
        context.fillText(this.char, this.x, this.y);
    }
}

export class BrushParticle extends Particle {
    constructor(effect, x, y, color) {
        super(effect, x, y, color);
        // Random brush size for artistic feel
        this.size = (Math.random() * 5 + 2) * (this.effect.gap / 2);
    }
    draw(context) {
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();
        // Maybe rect for blocky brush?
        // context.fillRect(this.x, this.y, this.size, this.size);
    }
}

class GalaxyParticle extends Particle {
    constructor(effect, x, y, color) {
        super(effect, x, y, color);
        // We want to maintain the image shape, so x,y are "home"
        this.originX = x;
        this.originY = y;
        this.color = color;
        this.size = Math.random() * 2 + 1;

        // Physics
        this.vx = 0;
        this.vy = 0;
        this.friction = 0.95;
        this.ease = 0.1;

        // Slight organic drift (star twinkle motion)
        this.angle = Math.random() * Math.PI * 2;
        this.driftSpeed = Math.random() * 0.02;
        this.driftRadius = Math.random() * 5; // Small wobble
        this.driftRadius = Math.random() * 5; // Small wobble
        this.flash = 0;
        this.baseSize = this.size;
        this.active = true;
        this.payload = []; // Stores absorbed particles
    }

    update() {
        if (!this.active) return; // Don't update dormant particles

        // 1. Drift
        this.angle += this.driftSpeed;
        const wobbleX = Math.cos(this.angle) * this.driftRadius;
        const wobbleY = Math.sin(this.angle) * this.driftRadius;

        // 2. Mouse Interaction
        const dx = this.effect.mouse.x - this.x;
        const dy = this.effect.mouse.y - this.y;
        const distance = dx * dx + dy * dy;

        let forceX = 0;
        let forceY = 0;

        // Initialize Angular Velocity if needed (Global for the particle)
        if (!this.angularVelocity) this.angularVelocity = 0;

        // Configurable Interaction Radius
        const interactionRadius = this.effect.config.interactionRadius || 150;
        const radiusSq = interactionRadius * interactionRadius;

        // --- COLOR BLENDING ---
        if (!this.baseRgb) {
            this.baseRgb = this.effect.hexToRgb(this.color);
            this.hotRgb = this.effect.hexToRgb(this.effect.config.hotColor || '#ffffff');
        }

        if (distance < radiusSq) {
            // Calculate proximity ratio (0 to 1, 1 being center)
            const dist = Math.sqrt(distance);
            const ratio = 1 - (dist / interactionRadius); // 1 = at center, 0 = at edge

            // Blend colors based on ratio
            // Simple Lerp
            const r = this.baseRgb.r + (this.hotRgb.r - this.baseRgb.r) * ratio;
            const g = this.baseRgb.g + (this.hotRgb.g - this.baseRgb.g) * ratio;
            const b = this.baseRgb.b + (this.hotRgb.b - this.baseRgb.b) * ratio;

            this.color = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;

            // ... (Physics Logic) ...
            const mouseForce = this.effect.config.mouseForce || 60;

            // Fixed Directional Bias (Simple Spin)
            const spiralSpeedConfig = this.effect.config.spiralSpeed !== undefined ? this.effect.config.spiralSpeed : 0.1;

            // Variable Spin: Faster at center
            // Ratio is 0 at edge, 1 at center.
            // Let's multiply speed by (1 + ratio * 4) -> 5x speed at center
            const speedMultiplier = 1 + ratio * 4;
            const spiralSpeed = spiralSpeedConfig * 0.1 * speedMultiplier;

            // Vector from Mouse to Particle
            const relX = this.x - this.effect.mouse.x;
            const relY = this.y - this.effect.mouse.y;

            // ROTATION (Orbit)
            const cos = Math.cos(spiralSpeed);
            const sin = Math.sin(spiralSpeed);

            let rotX = relX * cos - relY * sin;
            let rotY = relX * sin + relY * cos;

            // GRAVITY (Containment - Dynamic Gradient)
            // baseSuction is usually ~0.997. We decrease it as we get closer (more suction)
            const baseSuction = this.effect.config.suctionEase || 0.997;
            const suctionGradient = this.effect.config.suctionGradient !== undefined ? this.effect.config.suctionGradient : 0.01;
            const suctionStrength = suctionGradient * ratio; // Pull harder as ratio increases (closer to mouse)
            const gravity = baseSuction - suctionStrength;

            rotX *= gravity;
            rotY *= gravity;

            // Target Position (Next Step in Orbit)
            const targetX = this.effect.mouse.x + rotX;
            const targetY = this.effect.mouse.y + rotY;

            // ORBIT FORCE (Capture - Dynamic Gradient)
            // We increase the tracking strength as we get closer
            const baseTrack = this.effect.config.baseTrackStrength !== undefined ? this.effect.config.baseTrackStrength : 0.05;
            const pullGrad = this.effect.config.pullGradient !== undefined ? this.effect.config.pullGradient : 0.15;
            const trackStrength = baseTrack + (ratio * pullGrad);

            forceX = (targetX - this.x) * trackStrength;
            forceY = (targetY - this.y) * trackStrength;

            this.vx += forceX;
            this.vy += forceY;

        } else {
            // Revert Color smoothly? Or instant?
            // Instant is cheaper, smooth requires state. Let's do instant for now or partial lerp back?
            // Actually, just set it back to base color string (assuming hex or whatever logic).
            // But we stored base RGB.
            this.color = `rgb(${this.baseRgb.r}, ${this.baseRgb.g}, ${this.baseRgb.b})`;

            // REVERSIBLE FUSION: Release Payload (BIG BANG)
            if (this.payload.length > 0) {
                // "Big Bang": Explode everything out instantly
                while (this.payload.length > 0) {
                    const p = this.payload.pop();
                    if (p) {
                        p.active = true;
                        p.x = this.x;
                        p.y = this.y;

                        // EXPLOSION: High velocity outward
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 5 + 5; // Fast burst (5-10)
                        p.vx = Math.cos(angle) * speed;
                        p.vy = Math.sin(angle) * speed;
                        // Reduce friction slightly for the explosion? Default 0.9 is fine.
                    }
                }
                // Instant shrink
                this.size = this.baseSize;
            } else {
                if (this.size > this.baseSize) this.size = this.baseSize; // Ensure reset
            }

            // HOME FORCE (Release)
            const returnSpeed = this.effect.config.returnEase || this.ease;
            const homeForceX = (this.originX + wobbleX - this.x) * returnSpeed;
            const homeForceY = (this.originY + wobbleY - this.y) * returnSpeed;

            this.vx += homeForceX;
            this.vy += homeForceY;
        }

        // Flash decay
        if (this.flash > 0) this.flash -= 0.05;
        if (this.flash < 0) this.flash = 0;

        // Friction applies to all velocity
        this.vx *= this.friction;
        this.vy *= this.friction;

        this.x += this.vx;
        this.y += this.vy;
    }

    draw(context) {
        if (!this.active) return;
        if (this.flash > 0) {
            context.fillStyle = this.flash > 0.5 ? '#ffffff' : this.color;
            // Or true blending if performance allows, but ternary is faster for "flash"
            // Let's do a simple overlay logic:
            if (this.flash > 0.1) {
                context.save();
                context.fillStyle = '#ffffff';
                context.globalAlpha = this.flash;
                context.beginPath();
                context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                context.fill();
                context.restore();
            }
        }

        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();
    }
}


export class Effect {
    constructor(canvas, sideType, config, globalConfig) {
        this.canvas = canvas;
        this.context = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.sideType = sideType; // 'developer' or 'creative'
        this.config = config; // Already merged
        this.particles = [];
        this.gap = this.config.gap || 4;
        this.mouse = { x: 0, y: 0 };

        window.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        this.init();
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    init() {
        // Clear particles
        this.particles = [];
        // Note: We removed the separate 'galaxy' block because we want it to use the image logic below.

        const image = new Image();
        image.src = this.config.image;
        image.onload = () => {
            console.log(`Hero Image Loaded for ${this.sideType}`);

            // Calculate Aspect Ratio to "Cover" the canvas
            const imgRatio = image.width / image.height;
            const canvasRatio = this.width / this.height;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (canvasRatio > imgRatio) {
                // Canvas is wider than image -> fit width (crop top/bottom)
                // Actually if canvas is wider (e.g. panoramic), we need to scale image UP by Width?
                // Cover logic: Scale to fill the LARGER dimension relative to aspect.
                drawWidth = this.width;
                drawHeight = this.width / imgRatio;
                offsetX = 0;
                offsetY = (this.height - drawHeight) / 2;
            } else {
                // Canvas is taller than image -> fit height (crop sides)
                drawHeight = this.height;
                drawWidth = this.height * imgRatio;
                offsetX = (this.width - drawWidth) / 2;
                offsetY = 0;
            }

            // Draw image centered
            this.context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

            const pixels = this.context.getImageData(0, 0, this.width, this.height).data;
            this.context.clearRect(0, 0, this.width, this.height);

            // this.particles = []; // Moved to the beginning of init()
            for (let y = 0; y < this.height; y += this.gap) {
                for (let x = 0; x < this.width; x += this.gap) {
                    const index = (y * this.width + x) * 4;
                    const alpha = pixels[index + 3];
                    if (alpha > 0) {
                        const red = pixels[index];
                        // If it's NOT white background? The prompt said white bg black subject.
                        // We want particles on the SUBJECT (Black).
                        // So if Red < Threshold (Dark), create particle.
                        if (red < 100) {
                            let color;
                            if (this.sideType === 'developer') {
                                color = this.config.color;
                                const char = this.config.charSet[Math.floor(Math.random() * this.config.charSet.length)];
                                this.particles.push(new MatrixParticle(this, x, y, color, char));
                            } else {
                                // Creative
                                const colors = this.config.colors || ['#fff'];
                                color = colors[Math.floor(Math.random() * colors.length)];

                                if (this.config.type === 'galaxy') {
                                    this.particles.push(new GalaxyParticle(this, x, y, color));
                                } else {
                                    this.particles.push(new BrushParticle(this, x, y, color));
                                }
                            }
                        }
                    }
                }
            }
            console.log(`Created ${this.particles.length} particles for ${this.sideType}`);
            this.animate();
        };
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;

        // Re-initialize particles to fit new size
        this.init();
    }

    animate() {
        this.context.clearRect(0, 0, this.width, this.height);

        // Remove dead particles from fusion
        // this.particles = this.particles.filter(p => !p.dead);

        // Collision Logic (Only for Galaxy and when interacting)
        if (this.config.type === 'galaxy') {
            this.handleCollisions();
        }

        this.particles.forEach(p => {
            p.update();
            p.draw(this.context);
        });
        requestAnimationFrame(() => this.animate());
    }

    handleCollisions() {
        const interactionRadius = this.config.interactionRadius || 250;
        const sqRadius = interactionRadius * interactionRadius;

        // Optimization: Only check particles close to mouse
        // Filter list of candidates first? Or just iterate? 
        // Iterate is O(N^2) if all are close. 
        // Let's iterate but skip quick.

        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            if (!p1.active) continue;

            // Is p1 interacting?
            const dx1 = this.mouse.x - p1.x;
            const dy1 = this.mouse.y - p1.y;
            const d1Sq = dx1 * dx1 + dy1 * dy1;
            if (d1Sq > sqRadius) continue;

            // CORE FUSION: Only merge if close to center (e.g. < 50px)
            // This prevents the whole cloud from clumping
            if (d1Sq > 2500) continue; // 50 * 50

            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                if (!p2.active) continue;

                // Is p2 interacting?
                const dx2 = this.mouse.x - p2.x;
                const dy2 = this.mouse.y - p2.y;
                if (dx2 * dx2 + dy2 * dy2 > sqRadius) continue;

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < p1.size + p2.size) {
                    // Collision!
                    // Fix: Correctly pick the larger particle as survivor to prevent "jumping"
                    const survivor = p1.size >= p2.size ? p1 : p2;
                    const victim = survivor === p1 ? p2 : p1;

                    // Growth Logic: Area Preservation
                    const newAreaRadius = Math.sqrt(survivor.size * survivor.size + victim.size * victim.size);

                    // Cap size
                    const maxSize = this.config.maxParticleSize || 50;
                    if (survivor.size < maxSize) {
                        survivor.size = Math.min(newAreaRadius, maxSize);
                    }

                    survivor.flash = 1.0; // Explosion effect
                    victim.active = false; // Dormant
                    survivor.payload.push(victim);

                    // Momentum Conservation (Mass-weighted)
                    // larger particles are harder to move.
                    const m1 = survivor.size * survivor.size;
                    const m2 = victim.size * victim.size;
                    const totalMass = m1 + m2;

                    survivor.vx = (survivor.vx * m1 + victim.vx * m2) / totalMass;
                    survivor.vy = (survivor.vy * m1 + victim.vy * m2) / totalMass;

                    // If p1 was the victim, it's dead. Stop checking p1 against others.
                    if (victim === p1) break;
                }
            }
        }
    }
}
