# Portfolio - Configuration Guide

This portfolio is dynamically driven by `data.json`. You can customize everything from your personal info to the advanced physics of the background particle effects.

## 📁 General Configuration

### Profile
- `name`: Your full name displayed in headers.
- `links`: Key-value pairs for social icons (GitHub, LinkedIn, Instagram, etc.).
- `contact`: Email and Phone details used in the contact section.

---

## 💻 Section Content

### Developer & Creative
- `title`: The big heading for the section.
- `description`: The intro text for that side.
- `skills` / `softwares`: Arrays of strings displayed as badges.
- `projects` / `gallery`: lists of your work items/images.
- `highlightTitle`: (Creative Only) The title for the featured art highlight.
- `about.md`: The external markdown file loaded into the developer side.

---

## ✨ Hero Particle Effects (`heroConfig`)

Both `developer` and `creative` sides have their own physics settings.

### Base Physics
- `image`: The black & white image path used to seed particle positions.
- `type`: The effect engine to use (`matrix`, `galaxy`, or `brush`).
- `particleSize`: The visual size of each particle.
- `gap`: The grid spacing (lower = higher density/more particles).
- `mouseForce`: How strongly particles react to your cursor.
- `friction`: Velocity decay (lower values make particles feel "heavier").
- `ease`: How snappy particles return to their home position.

### Matrix Mode (Developer)
- `charSet`: String of characters (e.g., `"01"`) that particles flicker between.

### Galaxy Mode (Creative)
- `interactionRadius`: The distance at which particles start reacting to the mouse.
- `spiralSpeed`: Baseline orbital rotation speed.
- `limitParticleSize`: Max size a merged particle can grow.

#### 🌌 Advanced Galaxy Physics
- `pullGradient`: How much faster particles accelerate as they get closer to the mouse.
- `baseTrackStrength`: The initial "stickiness" to the mouse at the edge of the radius.
- `suctionEase`: Baseline inward gravity strength.
- `suctionGradient`: How much stronger the inward pull becomes near the center.

#### 💥 Fusion & Gamma Explosion
- `fusionRadius`: Distance from mouse where particles begin to merge/absorb.
- `flashColor`: The core color of the merge explosion (e.g., `"#ffffff"`).
- `flashSizeMultiplier`: Scale factor for the explosion shockwave.
- `flashIntensityMultiplier`: Brightness gain per merger.
- `hotColor`: The color particles glow as they heat up near the mouse.

#### ✨ Proximity Glow
- `glowScale`: radius multiplier for the subtle halo around active particles.
- `glowOpacity`: Max transparency of the particle glow.

#### 🌀 Stable Orbits (Orbital Retention)
- `orbitThreshold`: Sensitivity for speed-matching. Lower = easier to capture.
- `orbitStability`: How long particles stay captured in orbit before drifting home.

---

## 📱 UI & Mobile
- `headerHideThreshold`: (0.0 to 1.0) The ratio of the screen a panel occupies before its header fades away (Default `0.8` or 80%).

---

## 🚀 Technical Stack
- **Engine**: Custom Canvas API Physics.
- **Data**: JSON-driven architecture.
- **View**: Split-screen responsive CSS logic.

## FPS Testing
Copy this code and paste it in the console to test the FPS of the website.
```javascript
(function() {
    // Check if counter already exists
    if (document.getElementById('fps-counter')) return;
    var stats = document.createElement('div');
    stats.id = 'fps-counter';
    stats.style.position = 'fixed';
    stats.style.top = '10px';
    stats.style.left = '10px';
    stats.style.padding = '8px 12px';
    stats.style.background = 'rgba(0, 0, 0, 0.85)';
    stats.style.color = '#00ff00';
    stats.style.fontFamily = 'monospace';
    stats.style.fontSize = '16px';
    stats.style.fontWeight = 'bold';
    stats.style.zIndex = '1000000';
    stats.style.borderRadius = '4px';
    stats.style.border = '1px solid #444';
    stats.style.pointerEvents = 'none'; // So it doesn't block clicks
    stats.innerText = 'FPS: --';
    document.body.appendChild(stats);
    var lastTime = performance.now();
    var frameCount = 0;
    function update(time) {
        frameCount++;
        if (time - lastTime >= 1000) {
            var fps = Math.round((frameCount * 1000) / (time - lastTime));
            stats.innerText = 'FPS: ' + fps;
            frameCount = 0;
            lastTime = time;
        }
        requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
})();
```