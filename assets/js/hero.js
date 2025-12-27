
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
        this.proximity = 0; // 0 to 1 based on mouse distance
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

            this.proximity = ratio;
            // Quantize colors to improve cache hits (16 steps)
            const qr = Math.round(r / 16) * 16;
            const qg = Math.round(g / 16) * 16;
            const qb = Math.round(b / 16) * 16;
            this.color = `rgb(${qr}, ${qg}, ${qb})`;

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
            this.proximity = 0;

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

        // Flash decay (Gamma Explosion)
        if (this.flash > 0) this.flash -= 0.03; // Slightly slower decay (was 0.05)
        if (this.flash < 0) this.flash = 0;

        // Friction applies to all velocity
        this.vx *= this.friction;
        this.vy *= this.friction;

        this.x += this.vx;
        this.y += this.vy;
    }

    draw(context) {
        if (!this.active) return;

        // 1. Draw Particle Body First
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();

        // 2. Draw Constant Glow (if near mouse)
        if (this.proximity > 0) {
            const glowScale = this.effect.config.glowScale || 2.5;
            const glowOpacity = this.effect.config.glowOpacity || 0.4;
            const glowSize = this.size * glowScale;

            context.save();
            context.globalCompositeOperation = 'lighter';
            context.globalAlpha = this.proximity * glowOpacity;

            // Use pre-rendered gradient if available
            const glowCanvas = this.effect.getPreRenderedGradient(this.color, glowSize, 'glow');
            if (glowCanvas) {
                context.drawImage(glowCanvas, this.x - glowSize, this.y - glowSize, glowSize * 2, glowSize * 2);
            } else {
                const grad = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowSize);
                grad.addColorStop(0, this.color);
                grad.addColorStop(1, 'transparent');
                context.fillStyle = grad;
                context.beginPath();
                context.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
                context.fill();
            }
            context.restore();
        }

        // 3. Draw Gamma Explosion On Top (if merging)
        if (this.flash > 0) {
            const flashColor = this.effect.config.flashColor || '#ffffff';
            const sizeMult = this.effect.config.flashSizeMultiplier || 4;
            const flareSize = this.size * (1 + this.flash * sizeMult);

            context.save();
            context.globalCompositeOperation = 'lighter';
            context.globalAlpha = Math.min(this.flash, 1.0);

            // Use pre-rendered gradient if available
            const flashCanvas = this.effect.getPreRenderedGradient(this.color, flareSize, 'flash', flashColor);
            if (flashCanvas) {
                context.drawImage(flashCanvas, this.x - flareSize, this.y - flareSize, flareSize * 2, flareSize * 2);
            } else {
                const gradient = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, flareSize);
                gradient.addColorStop(0, flashColor);
                gradient.addColorStop(0.3, this.color);
                gradient.addColorStop(1, 'transparent');
                context.fillStyle = gradient;
                context.beginPath();
                context.arc(this.x, this.y, flareSize, 0, Math.PI * 2);
                context.fill();
            }
            context.restore();
        }
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
            // Use clientX/Y and scale based on CSS vs Canvas size
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        });

        this.init();

        // Optimization: Gradient Cache
        this.gradientCache = new Map();

        // Optimization: Spatial Partitioning Grid
        this.gridSize = 60; // Slightly larger grid for fewer cells
        this.grid = [];
    }

    getPreRenderedGradient(color, radius, type, flashColor = '#ffffff') {
        const qRadius = Math.ceil(radius / 10) * 10; // Coarser quantization
        const cacheKey = `${color}-${qRadius}-${type}-${flashColor}`;

        if (this.gradientCache.has(cacheKey)) {
            return this.gradientCache.get(cacheKey);
        }

        // Limit cache size - much larger limit if needed, but quantization helps more
        if (this.gradientCache.size > 500) {
            const firstKey = this.gradientCache.keys().next().value;
            this.gradientCache.delete(firstKey);
        }

        const canvas = document.createElement('canvas');
        canvas.width = qRadius * 2;
        canvas.height = qRadius * 2;
        const ctx = canvas.getContext('2d', { alpha: true }); // Ensure alpha

        const grad = ctx.createRadialGradient(qRadius, qRadius, 0, qRadius, qRadius, qRadius);
        if (type === 'glow') {
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'transparent');
        } else if (type === 'flash') {
            grad.addColorStop(0, flashColor);
            grad.addColorStop(0.3, color);
            grad.addColorStop(1, 'transparent');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        this.gradientCache.set(cacheKey, canvas);
        return canvas;
    }

    updateGrid() {
        this.grid = [];
        const cols = Math.ceil(this.width / this.gridSize);
        const rows = Math.ceil(this.height / this.gridSize);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            const col = Math.floor(p.x / this.gridSize);
            const row = Math.floor(p.y / this.gridSize);

            if (col >= 0 && col < cols && row >= 0 && row < rows) {
                const index = row * cols + col;
                if (!this.grid[index]) this.grid[index] = [];
                this.grid[index].push(p);
            }
        }
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
            this.updateGrid();
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
        const fusionRadius = this.config.fusionRadius || 50;
        const sqFusionRadius = fusionRadius * fusionRadius;

        const cols = Math.ceil(this.width / this.gridSize);

        // Only check particles near the mouse
        const mouseCol = Math.floor(this.mouse.x / this.gridSize);
        const mouseRow = Math.floor(this.mouse.y / this.gridSize);
        const gridRange = Math.ceil(interactionRadius / this.gridSize);

        for (let r = mouseRow - gridRange; r <= mouseRow + gridRange; r++) {
            for (let c = mouseCol - gridRange; c <= mouseCol + gridRange; c++) {
                if (r < 0 || c < 0 || r >= Math.ceil(this.height / this.gridSize) || c >= cols) continue;

                const index = r * cols + c;
                const cell = this.grid[index];
                if (!cell) continue;

                for (let i = 0; i < cell.length; i++) {
                    const p1 = cell[i];
                    if (!p1.active) continue;

                    const dx1 = this.mouse.x - p1.x;
                    const dy1 = this.mouse.y - p1.y;
                    const d1Sq = dx1 * dx1 + dy1 * dy1;
                    if (d1Sq > sqFusionRadius) continue;

                    for (let j = i + 1; j < cell.length; j++) {
                        const p2 = cell[j];
                        if (!p2.active) continue;

                        const dx = p1.x - p2.x;
                        const dy = p1.y - p2.y;
                        const distSq = dx * dx + dy * dy;

                        if (distSq < (p1.size + p2.size) * (p1.size + p2.size)) {
                            const survivor = p1.size >= p2.size ? p1 : p2;
                            const victim = survivor === p1 ? p2 : p1;

                            const newAreaRadius = Math.sqrt(survivor.size * survivor.size + victim.size * victim.size);
                            const maxSize = this.config.maxParticleSize || 50;
                            if (survivor.size < maxSize) {
                                survivor.size = Math.min(newAreaRadius, maxSize);
                            }

                            const m1 = survivor.size * survivor.size;
                            const m2 = victim.size * victim.size;
                            const intensity = (this.config.flashIntensityMultiplier || 1) * (m2 / 10);
                            survivor.flash = Math.min(survivor.flash + intensity, 2.0);

                            victim.active = false;
                            survivor.payload.push(victim);

                            const totalMass = m1 + m2;
                            survivor.vx = (survivor.vx * m1 + victim.vx * m2) / totalMass;
                            survivor.vy = (survivor.vy * m1 + victim.vy * m2) / totalMass;

                            if (victim === p1) break;
                        }
                    }
                }
            }
        }
    }
}
