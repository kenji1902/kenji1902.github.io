
// assets/js/app.js

const container = document.getElementById('split-container');
const creativeSide = document.getElementById('creative-side');
const handle = document.getElementById('slider-handle');

let isDragging = false;

// Helpers
const getX = (e) => e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
const getY = (e) => e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

function startDrag(e) {
    isDragging = true;
    handle.style.cursor = 'grabbing';
    document.body.style.cursor = 'grabbing';

    // Prevent default touch actions (scrolling) while dragging handle
    if (e.type === 'touchstart') e.preventDefault();
}

function stopDrag() {
    isDragging = false;
    handle.style.cursor = window.innerWidth <= 768 ? 'row-resize' : 'col-resize';
    document.body.style.cursor = 'default';
}

// Helper to interpolate
const lerp = (start, end, t) => start * (1 - t) + end * t;

// INITIALIZATION
// Trigger logical update for default 50% split
function initSlider() {
    // const containerRect = container.getBoundingClientRect(); // Deprecated for Viewport Logic
    const isMobile = window.innerWidth <= 768;

    // Simulate a "move" event params or just call logic
    // Let's abstract the logic or just mock the event object
    // Mock event at center
    const mockEvent = {
        type: 'mouse',
        pageX: window.innerWidth / 2,
        pageY: window.innerHeight / 2,
        preventDefault: () => { }
    };

    // Temporarily set isDragging to true to allow moveDrag to run
    const wasDragging = isDragging;
    isDragging = true;

    // Ensure mock event has clientX/Y for new helpers
    mockEvent.clientX = mockEvent.pageX;
    mockEvent.clientY = mockEvent.pageY;

    moveDrag(mockEvent);
    isDragging = wasDragging;
}

// Run init after DOM content load or stack clear
// Use setTimeout to ensure layout is painted
setTimeout(initSlider, 100);


// State for Handle Position (Viewport Y)
let currentHandleY = 0;

// SCROLL SYNC FOR MOBILE CLIP-PATH
function updateMobileClip() {
    if (window.innerWidth > 768) return;

    // OPTIMIZED: Use cached handle position to avoid Layout Thrashing (getBoundingClientRect)
    // This removes the "delay" caused by heavy DOM reads during scroll.
    const scrollY = window.scrollY;

    const cutPos = scrollY + currentHandleY;
    creativeSide.style.clipPath = `inset(${cutPos}px 0 0 0)`;
}

// Attach scroll listener
window.addEventListener('scroll', () => {
    // Only update if not dragging (dragging handles it) or just always update?
    // Dragging updates via moveDrag. Scrolling updates via this.
    // To allow smooth scroll+drag, usually fine.
    if (!isDragging) requestAnimationFrame(updateMobileClip);
});

// Update moveDrag to use this logic for Mobile
function moveDrag(e) {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault(); // Stop scrolling while dragging

    const isMobile = window.innerWidth <= 768;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Select Headers
    const devHeader = document.querySelector('.dev-hero .hero-content');
    const creativeHeader = document.querySelector('.creative-hero .hero-content');

    if (isMobile) {
        // VERTICAL SLIDER LOGIC
        // "Sliding Panel" visual, but implemented via Clip-Path for robust scrolling
        let y = getY(e);

        // Clamp
        if (y < 0) y = 0;
        if (y > windowHeight) y = windowHeight;

        // Update State Cache
        currentHandleY = y;

        // Reset Styles for Overlap
        creativeSide.style.height = '100%';
        creativeSide.style.width = '100vw';
        creativeSide.style.top = '0'; // Aligned with Dev
        creativeSide.style.bottom = 'auto';

        // Clip Path Logic
        // We calculate the cut relative to document top
        const scrollY = window.scrollY;
        const cutPos = scrollY + y;
        creativeSide.style.clipPath = `inset(${cutPos}px 0 0 0)`;

        // Handle Position (Fixed Viewport)
        handle.style.top = `${y}px`;
        handle.style.left = '0';
        handle.style.bottom = 'auto';
        handle.style.transform = 'translateY(-50%)';

        // ANIMATE HEADERS (MOBILE)
        const threshold = (window.mobileConfig && window.mobileConfig.headerHideThreshold) !== undefined
            ? window.mobileConfig.headerHideThreshold
            : 0.8;

        if (devHeader) {
            const devCenter = y / 2;
            devHeader.style.top = `${devCenter}px`;

            // Opacity: Hide if height ratio is ABOVE threshold (dominant panel)
            const devRatio = y / windowHeight;
            devHeader.style.opacity = devRatio > threshold ? 0 : 1;
        }

        if (creativeHeader) {
            const creativeCenter = y + (windowHeight - y) / 2;
            creativeHeader.style.top = `${creativeCenter}px`;

            // Opacity: Hide if height ratio is ABOVE threshold (dominant panel)
            const creativeRatio = (windowHeight - y) / windowHeight;
            creativeHeader.style.opacity = creativeRatio > threshold ? 0 : 1;
        }

    } else {
        // HORIZONTAL SLIDER LOGIC
        // Reset Mobile Styles
        creativeSide.style.clipPath = 'none';
        creativeSide.style.top = '0';

        let x = getX(e);

        // Clamp
        if (x < 0) x = 0;
        if (x > windowWidth) x = windowWidth;

        // Percentage derived from Left (Viewport 0 to Viewport Width)
        let ratio = x / windowWidth;
        let percentage = (1 - ratio) * 100; // Creative Width%

        // Apply width to Creative Side using VW to match Handle's Fixed Viewport positioning
        // This ensures the split line (border-left of right side) aligns with handle
        creativeSide.style.width = `${percentage}vw`;
        creativeSide.style.height = '100%';

        // Handle Position - Use VW to be exact
        handle.style.left = `${ratio * 100}vw`;
        handle.style.bottom = 'auto';
        handle.style.top = '50%';
        handle.style.transform = 'translate(-50%, -50%)';

        // ANIMATE HEADERS
        const threshold = (window.mobileConfig && window.mobileConfig.headerHideThreshold) !== undefined
            ? window.mobileConfig.headerHideThreshold
            : 0.8;

        if (devHeader) {
            let devCenter = (ratio * 100) / 2;
            devHeader.style.left = `${devCenter}vw`; // Use vw
            devHeader.style.opacity = ratio > threshold ? 0 : 1;
        }

        if (creativeHeader) {
            let creativeRatio = 1 - ratio;
            let creativeCenter = (creativeRatio * 100) / 2;
            creativeHeader.style.right = `${creativeCenter}vw`; // Use vw
            creativeHeader.style.opacity = creativeRatio > threshold ? 0 : 1;
        }
    }
}

// Event Listeners
handle.addEventListener('mousedown', startDrag);
handle.addEventListener('touchstart', startDrag, { passive: false });

window.addEventListener('mouseup', stopDrag);
window.addEventListener('touchend', stopDrag);

window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, { passive: false });

// Window Resize Handler
window.addEventListener('resize', () => {
    if (!isDragging) {
        handle.style.cursor = window.innerWidth <= 768 ? 'row-resize' : 'col-resize';
    }
});

// Run init after DOM content load or stack clear
setTimeout(initSlider, 100);

// UNIFIED SCROLL LOGIC
// We need to set the height of the split-container to match the taller content
// (Dev vs Creative) so the body scrollbar accommodates it.

function updateHeight() {
    const devContent = document.querySelector('.developer-side .content-wrapper');
    const creativeContent = document.querySelector('.creative-side .content-wrapper');
    const container = document.getElementById('split-container');

    // We also need to include the Hero height (100vh) if content flow starts after it.
    // In our CSS, Hero is 100vh. Content wrapper follows.
    // Actually, .side is absolute top:0.
    // Content layout:
    // .hero { height: 100vh }
    // .content-wrapper { ... }

    // So Total Height = Hero (100vh) + Content Height + Padding
    const heroHeight = window.innerHeight;

    // Measure content
    const devHeight = devContent ? devContent.scrollHeight : 0;
    const creativeHeight = creativeContent ? creativeContent.scrollHeight : 0;

    const maxContentHeight = Math.max(devHeight, creativeHeight);

    // Total Container Height
    // Add extra padding at bottom if needed
    container.style.height = `${heroHeight + maxContentHeight + 100}px`;
}

// Call updateHeight on:
// 1. Initial Load (after data)
// 2. Resize
// 3. Image loads (if they affect height)
window.addEventListener('resize', updateHeight);
// Also export it or listen for a custom event from loader?
// For now, let's expose it globally or poll it?
// Loader should trigger it.
window.updateHeight = updateHeight;

// Observer for content changes?
const observer = new ResizeObserver(updateHeight);
const devWrapper = document.querySelector('.developer-side .content-wrapper');
const creativeWrapper = document.querySelector('.creative-side .content-wrapper');

// Wait for elements to exist (they might be empty initially)
if (devWrapper) observer.observe(devWrapper);
if (creativeWrapper) observer.observe(creativeWrapper);
// If they are dynamic, maybe observe the sides?
// We will call updates from loader.js too.

