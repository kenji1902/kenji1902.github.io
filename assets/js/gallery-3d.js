/* assets/js/gallery-3d.js */

// Three.js Core Variables
let scene, camera, renderer, playerGroup;
let animationFrameId = null;

// Grid & Map Properties
const CELL_SIZE = 10;
const WALL_HEIGHT = 8;
let mapGrid = [];
let artworkList = [];
let gridWidth = 8;
let gridHeight = 8;

// Player/Camera State
let player = {
    pos: { x: 0, y: 1.8, z: 0 }, // Standard eye-level height
    vel: { x: 0, z: 0 },
    yaw: 0,      // Left/Right rotation (radians)
    pitch: 0,    // Up/Down rotation (radians)
    targetYaw: 0,
    targetPitch: 0,
    height: 3.8,
    crouchHeight: 1.0,
    radius: 1.2  // Collision radius
};

// Input Management
let keys = { w: false, a: false, s: false, d: false, ctrl: false };
let mouse = { x: 0, y: 0 };
let touchStart = { x: 0, y: 0 };
let gyro = {
    alpha: 0, beta: 0, gamma: 0,
    prevAlpha: null, prevBeta: null, prevGamma: null,
    enabled: false
};
let activeTouches = 0;

// Textures (Procedurally Generated to work fully offline and load instantly)
let textures = {};

// 3D Wall-mounted Artwork Objects
let interactivePaintings = []; // List of { mesh, data, col, row, faceDirection }

// Ambient Music Synth (Web Audio API)
let audioCtx = null;
let synthInterval = null;
let activeSynthNodes = [];
let isMusicPlaying = false;

// Guided Tour State
let isTourActive = false;
let tourStops = []; // List of { pos: {x,z}, yaw, data }
let currentTourStopIdx = 0;
let tourTimer = null;
let tourLerpTime = 0;
const TOUR_SPEED = 0.015; // Camera flying speed
let tourState = 'flying'; // 'flying', 'viewing'
let tourViewStartTime = 0;

// Dynamic Info Panel DOM
const infoCard = document.getElementById('artwork-info-card');
const detailTitle = document.getElementById('artwork-detail-title');
const detailSubtitle = document.getElementById('artwork-detail-subtitle');
const detailDesc = document.getElementById('artwork-detail-desc');
const detailBadge = document.getElementById('artwork-type-badge');
const detailLink = document.getElementById('artwork-external-link');
const detailLinkContainer = document.getElementById('artwork-external-link-container');
const btnMusic = document.getElementById('btn-music');
const btnTour = document.getElementById('btn-tour');
const btnHelp = document.getElementById('btn-help');
const btnCalibrate = document.getElementById('btn-calibrate');
const controlsHelpModal = document.getElementById('controls-help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');
const tourBanner = document.getElementById('tour-banner');
const btnStopTour = document.getElementById('btn-stop-tour');

// Mobile Joystick State
const joystickContainer = document.getElementById('mobile-joystick-container');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };

// ========================================================
// 1. ENGINE INITIALIZATION & START
// ========================================================
export function start3DGallery(editorGrid, loadedArtworks, width, height) {
    mapGrid = editorGrid;
    artworkList = loadedArtworks;
    gridWidth = width || 8;
    gridHeight = height || 8;

    // Set up Three.js WebGL Renderer
    const container = document.getElementById('gallery-screen');
    const canvas = document.getElementById('canvas-3d');

    // Show Loading Overlay while we prepare assets
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('fade-out');

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });

    // Safeguard for zero dimensions (browser reflow delays)
    const renderWidth = container.clientWidth || window.innerWidth;
    const renderHeight = container.clientHeight || window.innerHeight;

    renderer.setSize(renderWidth, renderHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Lowering from 2 to 1.5 greatly boosts mobile FPS
    renderer.shadowMap.enabled = false; // Disabling real-time shadows significantly reduces rotation lag
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true; // Enable WebXR

    // Create Scene & Camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#faf8f4'); // Warm gallery white
    scene.fog = new THREE.FogExp2('#faf8f4', 0.008); // Soft warm haze

    camera = new THREE.PerspectiveCamera(60, renderWidth / renderHeight, 0.1, 100);
    
    // Create a group to hold the player/camera for XR tracking
    playerGroup = new THREE.Group();
    playerGroup.add(camera);
    scene.add(playerGroup);

    // Setup Loading Manager to track all textures (floor, wall, art)
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = () => {
        console.log("3D Gallery Assets Loaded Successfully");
        
        // Position Player at Spawn Point
        spawnPlayer();

        // Open controls help on first open
        controlsHelpModal.classList.remove('hidden');

        // Mobile-specific UI adjustments
        adjustHUDForMobile();

        // Finalize state and Start Game Loop
        isTourActive = false;
        currentTourStopIdx = 0;
        tourState = 'flying';
        tourBanner.classList.add('hidden');
        infoCard.classList.add('hidden');
        
        // Add VR Button to the UI
        import('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/webxr/VRButton.js').then((module) => {
            document.body.appendChild(module.VRButton.createButton(renderer));
        });

        renderer.setAnimationLoop(animate);

        // Reveal the gallery
        if (loadingOverlay) loadingOverlay.classList.add('fade-out');
        if (isMusicPlaying) startSynthesizer();
    };

    // Load Gallery Textures from Images
    loadGalleryTextures(loadingManager);

    // Build 3D Map
    build3DScene(loadingManager);

    // Setup Controls
    setupInputControls();

    // Force a resize calculation shortly after start to guarantee correct sizing after DOM transitions
    setTimeout(() => {
        handleWindowResize();
    }, 150);

    // Resize Listener
    window.addEventListener('resize', handleWindowResize);
}

export function stop3DGallery() {
    // Stop Animation Loop
    renderer.setAnimationLoop(null);

    // Stop Audio Synthesizer
    stopSynthesizer();

    // Clean up event listeners
    window.removeEventListener('resize', handleWindowResize);
    removeInputControls();

    // Reset HUD DOM States
    controlsHelpModal.classList.add('hidden');
    tourBanner.classList.add('hidden');
    infoCard.classList.add('hidden');

    // Dispose resources to prevent GPU leaks
    if (scene) {
        scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        scene = null;
    }
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
    camera = null;
    interactivePaintings = [];
}

// ========================================================
// 2. TEXTURE LOADER
// ========================================================
function loadGalleryTextures(manager) {
    const loader = new THREE.TextureLoader(manager);

    // 1. FLOOR TEXTURE: Load a high-res wood or stone image
    const floorTex = loader.load('assets/home/images/gallery_floor.jpg');
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4); // Increased repetition for realistic scale
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textures.floor = floorTex;

    // 2. WALL TEXTURE: Load a subtle plaster or concrete image
    const wallTex = loader.load('assets/home/images/gallery_wall.jpg');
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(2, 2);
    textures.wall = wallTex;
}

// ========================================================
// 3. MAP BUILDER & 3D GEOMETRY
// ========================================================
function build3DScene(manager) {
    interactivePaintings = [];

    // Setup gallery lighting: warm ambient fill + ceiling key light
    // Warm cream ambient — not too bright, let spotlights do the work
    const ambientLight = new THREE.AmbientLight('#fff8f0', 0.38);
    scene.add(ambientLight);

    // Hemisphere: warm sky, warm floor bounce — muted so floor stays wood-toned
    const hemiLight = new THREE.HemisphereLight('#fff5e8', '#c8a96e', 0.28);
    scene.add(hemiLight);

    // Directional fill — very soft, no harsh shadows from room fill
    const dirLight = new THREE.DirectionalLight('#fff8f0', 0.15);
    dirLight.position.set(5, 20, 5);
    dirLight.castShadow = false; 
    scene.add(dirLight);

    // Generate Floors, Ceilings, and Walls based on the active 2D matrix
    const toIndex = (r, c) => r * gridWidth + c;

    for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
            const cell = mapGrid[toIndex(r, c)];
            const x = c * CELL_SIZE + CELL_SIZE / 2;
            const z = r * CELL_SIZE + CELL_SIZE / 2;

            // 1. RENDER WALKABLE FLOOR & CEILING
            if (cell.type === 'floor' || cell.type === 'spawn') {
                // Floor Tile
                const floorGeo = new THREE.BoxGeometry(CELL_SIZE, 0.1, CELL_SIZE);
                const floorMat = new THREE.MeshStandardMaterial({
                    map: textures.floor,
                    roughness: 0.35, // Semi-polished hardwood
                    metalness: 0.05
                });
                const floorMesh = new THREE.Mesh(floorGeo, floorMat);
                floorMesh.position.set(x, -0.05, z);
                floorMesh.receiveShadow = true;
                scene.add(floorMesh);

                // Ceiling Tile
                const ceilGeo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
                const ceilMat = new THREE.MeshStandardMaterial({
                    color: '#ffffff',
                    roughness: 1.0
                });
                const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
                ceilMesh.rotation.x = Math.PI / 2;
                ceilMesh.position.set(x, WALL_HEIGHT, z);
                scene.add(ceilMesh);
            }

            // 2. RENDER PLAIN WALL BLOCK
            else if (cell.type === 'wall') {
                const wallGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
                const wallMat = new THREE.MeshStandardMaterial({
                    map: textures.wall,
                    roughness: 0.7,
                    metalness: 0.1
                });
                const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                wallMesh.position.set(x, WALL_HEIGHT / 2, z);
                // wallMesh.castShadow = true;
                // wallMesh.receiveShadow = true;
                scene.add(wallMesh);
            }

            // 3. RENDER ART EXPOSITION WALL
            else if (cell.type === 'art') {
                // Create solid Wall Block
                const wallGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
                const wallMat = new THREE.MeshStandardMaterial({
                    map: textures.wall,
                    roughness: 0.7,
                    metalness: 0.1,
                    emissive: new THREE.Color(0x222222),
                    emissiveIntensity: 1
                });
                const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                wallMesh.position.set(x, WALL_HEIGHT / 2, z);
                // wallMesh.castShadow = true;
                // wallMesh.receiveShadow = true;
                scene.add(wallMesh);

                // Place individual paintings based on face assignments
                if (cell.type === 'art') {
                    placePaintingsOnWall(r, c, cell, manager);
                }
            }
        }
    }
}

function placePaintingsOnWall(row, col, cell, manager) {
    const toIndex = (r, c) => r * gridWidth + c;
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const z = row * CELL_SIZE + CELL_SIZE / 2;

    // Check neighbor cells: North, South, East, West.
    // If a neighbor cell is walkable ('floor' or 'spawn'), place painting facing it!
    const neighbors = [
        { dir: 'N', r: row - 1, c: col, rotY: Math.PI, offsetX: 0, offsetZ: -CELL_SIZE / 2 - 0.06 },
        { dir: 'S', r: row + 1, c: col, rotY: 0, offsetX: 0, offsetZ: CELL_SIZE / 2 + 0.06 },
        { dir: 'E', r: row, c: col + 1, rotY: Math.PI / 2, offsetX: CELL_SIZE / 2 + 0.06, offsetZ: 0 },
        { dir: 'W', r: row, c: col - 1, rotY: -Math.PI / 2, offsetX: -CELL_SIZE / 2 - 0.06, offsetZ: 0 }
    ];

    const textureLoader = new THREE.TextureLoader(manager);

    neighbors.forEach(n => {
        // Bounds check
        if (n.r >= 0 && n.r < gridHeight && n.c >= 0 && n.c < gridWidth) {
            const neighborCell = mapGrid[toIndex(n.r, n.c)];
            if (neighborCell.type === 'floor' || neighborCell.type === 'spawn') {
                
                // Find the specific art assigned to THIS face (N, S, E, or W)
                const artIdForFace = cell.artIds ? cell.artIds[n.dir] : null;
                if (!artIdForFace) return; // No art assigned to this specific face

                const artData = artworkList.find(a => a.id === artIdForFace);
                if (!artData) return;

                // 1. Frame dimensions
                const artW = 4.8;
                const artH = 3.6;
                const frameThick = 0.15;

                // Frame — thin silver/gold gallery frame
                const frameColor = artData.type === 'developer' ? '#a8d8ea' : '#c8a96e';
                const frameGeo = new THREE.BoxGeometry(artW + 0.45, artH + 0.45, frameThick);
                const frameMat = new THREE.MeshStandardMaterial({
                    color: frameColor,
                    roughness: 0.15,
                    metalness: 0.92
                });
                const frameMesh = new THREE.Mesh(frameGeo, frameMat);

                // Inner white mat (like a real gallery mount)
                const matGeo = new THREE.BoxGeometry(artW + 0.15, artH + 0.15, 0.04);
                const matMat = new THREE.MeshStandardMaterial({ color: '#f8f5f0', roughness: 1.0 });
                const matMesh = new THREE.Mesh(matGeo, matMat);
                matMesh.position.z = 0.02;
                frameMesh.add(matMesh);

                // Canvas surface material — starts as warm fallback,
                // updated async when texture loads
                const canvasMat = new THREE.MeshStandardMaterial({
                    color: 0x000000, // Black diffuse color ignores scene lighting
                    roughness: 1.0,  // High roughness prevents specular glare from spotlights
                    metalness: 0.0
                });

                // Generate a rich canvas fallback immediately so nothing is black
                createArtFallbackTexture(artData, canvasMat);

                // Try loading the real image (works on https/GitHub Pages)
                textureLoader.load(
                    artData.image,
                    (tex) => {
                        // SUCCESS — swap in the real image texture
                        canvasMat.map = tex;
                        canvasMat.emissiveMap = tex; // Map texture to the emissive channel
                        
                        // ─ Aspect Ratio Correction ─
                        const imageAspect = tex.image.width / tex.image.height;
                        const defaultAspect = artW / artH;
                        
                        if (imageAspect < defaultAspect) {
                            // Portrait orientation: Shrink width to prevent stretching
                            frameMesh.scale.x = imageAspect / defaultAspect;
                        } else {
                            // Landscape orientation: Shrink height if extra wide
                            frameMesh.scale.y = defaultAspect / imageAspect;
                        }

                        // ─ Lighting Adjustment ─
                        // Controlled entirely via emissive to ignore external lights
                        canvasMat.emissive = new THREE.Color('#f5e9c6');
                        canvasMat.emissiveIntensity = 1.0; 
                        canvasMat.needsUpdate = true;
                    
                    },
                    undefined,
                    () => {
                        // FAIL — fallback already applied, nothing to do
                        console.warn('Could not load image, using fallback:', artData.image);
                    }
                );

                const canvasGeo = new THREE.BoxGeometry(artW, artH, 0.05);
                const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat);
                canvasMesh.position.z = 0.08;
                frameMesh.add(canvasMesh);

                // Positioning on wall
                frameMesh.position.set(x + n.offsetX, 3.8, z + n.offsetZ);
                frameMesh.rotation.y = n.rotY;
                scene.add(frameMesh);

                // 2. CEILING TRACK LIGHT
                // Calculate light position 2.5 units away from the wall face
                const lightDist = 4.5;
                const lx = x + (n.offsetX * (1 + lightDist / (CELL_SIZE / 2)));
                const lz = z + (n.offsetZ * (1 + lightDist / (CELL_SIZE / 2)));

                const fwx = frameMesh.position.x;
                const fwz = frameMesh.position.z;

                // ─ Ceiling mount plate — flush on ceiling ─
                const mountGeo = new THREE.BoxGeometry(0.25, 0.08, 0.25);
                const mountMat = new THREE.MeshStandardMaterial({ color: '#c0bfbd', metalness: 0.85, roughness: 0.2 });
                const mountMesh = new THREE.Mesh(mountGeo, mountMat);
                mountMesh.position.set(lx, WALL_HEIGHT - 0.04, lz);
                scene.add(mountMesh);

                // ─ Shortened Hanging rod (closer to ceiling) ─
                const rodHeight = 0.5;
                const rodHangGeo = new THREE.CylinderGeometry(0.035, 0.035, rodHeight, 8);
                const rodHangMat = new THREE.MeshStandardMaterial({ color: '#a8a8a8', metalness: 0.9, roughness: 0.15 });
                const rodHangMesh = new THREE.Mesh(rodHangGeo, rodHangMat);
                // Rod center = ceiling - mount(0.08) - half rod(0.25)
                rodHangMesh.position.set(lx, WALL_HEIGHT - 0.08 - (rodHeight / 2), lz);
                scene.add(rodHangMesh);

                // ─ Directional Fixture Head Group ─
                const fixtureY = WALL_HEIGHT - 0.08 - rodHeight; 
                const headGroup = new THREE.Group();
                headGroup.position.set(lx, fixtureY, lz);

                // Fixture body: Cylindrical spotlight canister
                const bodyGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16);
                bodyGeo.rotateX(Math.PI / 2); // Orient cylinder to point along Z axis
                const bodyMat = new THREE.MeshStandardMaterial({
                    color: '#e0dedd',
                    roughness: 0.6,
                    metalness: 0.06
                });
                const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
                headGroup.add(bodyMesh);

                // Black lens ring at front of canister
                const lensRingGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.05, 20);
                lensRingGeo.rotateX(Math.PI / 2);
                const lensRingMat = new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.9, roughness: 0.1 });
                const lensRingMesh = new THREE.Mesh(lensRingGeo, lensRingMat);
                lensRingMesh.position.z = 0.31;
                headGroup.add(lensRingMesh);

                // Warm glowing lens disc
                const lensGeo = new THREE.CircleGeometry(0.19, 20);
                const lensMat = new THREE.MeshStandardMaterial({ 
                    color: '#000000', 
                    emissive: '#ffffff', // Pure white core for that "hot" light look
                    emissiveIntensity: 15 
                });
                const lensMesh = new THREE.Mesh(lensGeo, lensMat);
                lensMesh.position.z = 0.34;
                headGroup.add(lensMesh);

                // Point the entire head at the painting
                headGroup.lookAt(fwx, 3.6, fwz);
                scene.add(headGroup);

                // ─ Directional SpotLight ─
                // We parent the light to the headGroup so it emits from the lens and follows the rotation
                const spotLight = new THREE.SpotLight('#ffe490', 3.5); // Boosted beam power
                spotLight.angle = Math.PI / 6.5;
                spotLight.penumbra = 0.65;
                spotLight.decay = 1.2;
                spotLight.distance = 12;
                spotLight.castShadow = false;
                
                // Position light at the lens (local Z) and set its target further ahead in local space
                spotLight.position.set(0, 0, 0.35);
                spotLight.target.position.set(0, 0, 1);
                
                headGroup.add(spotLight);
                headGroup.add(spotLight.target);

                // Track this painting for player proximity HUD overlays
                interactivePaintings.push({
                    mesh: frameMesh,
                    data: artData,
                    col: col,
                    row: row,
                    faceDirection: n.dir
                });
            }
        }
    });
}

// Create a rich canvas fallback texture (used when real image can't load locally)
function createArtFallbackTexture(artData, material) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Background gradient based on artwork type
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    if (artData.type === 'developer') {
        grad.addColorStop(0, '#1a2a4a');
        grad.addColorStop(1, '#0d3b5e');
    } else {
        grad.addColorStop(0, '#3a1a2a');
        grad.addColorStop(0.5, '#5c2d3a');
        grad.addColorStop(1, '#2a1520');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle canvas texture grain
    for (let i = 0; i < 4000; i++) {
        const gx = Math.random() * 512;
        const gy = Math.random() * 512;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
        ctx.fillRect(gx, gy, 1 + Math.random(), 1 + Math.random());
    }

    // Accent color strokes (painterly feel)
    const accentColor = artData.type === 'developer' ? '#4fc3f7' : '#f4a261';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.bezierCurveTo(
            Math.random() * 512, Math.random() * 512,
            Math.random() * 512, Math.random() * 512,
            Math.random() * 512, Math.random() * 512
        );
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Inner frame mat area
    ctx.fillStyle = 'rgba(255,252,245,0.07)';
    ctx.fillRect(32, 32, 448, 448);

    // Title text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Outfit", sans-serif';

    // Word wrap title
    const words = (artData.title || 'Untitled').split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > 400 && line) {
            lines.push(line.trim());
            line = word + ' ';
        } else { line = test; }
    }
    lines.push(line.trim());

    const startY = 256 - ((lines.length - 1) * 36) / 2;
    lines.forEach((l, i) => ctx.fillText(l, 256, startY + i * 36));

    // Subtitle
    ctx.fillStyle = accentColor;
    ctx.font = '16px "Space Mono", monospace';
    ctx.fillText(artData.subtitle || '', 256, startY + lines.length * 36 + 20);

    // Bottom hint (local dev only)
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px "Space Mono", monospace';
    ctx.fillText('Preview on GitHub Pages for full image', 256, 460);

    material.map = new THREE.CanvasTexture(canvas);
    // WHITE emissive so the canvas self-illuminates fully — this is the key fix
    // for file:// local dev where spotlights alone don't light the canvas
    material.emissive = new THREE.Color(0xffffff);
    material.emissiveIntensity = 0.5; // Lowered to prevent initial glare
    material.needsUpdate = true;
}

// Position Player at Spawn Point
function spawnPlayer() {
    const toIndex = (r, c) => r * gridWidth + c;
    let spawnIdx = mapGrid.findIndex(cell => cell.type === 'spawn');

    // Fallback if spawn is missing
    if (spawnIdx === -1) spawnIdx = mapGrid.findIndex(cell => cell.type === 'floor');
    if (spawnIdx === -1) spawnIdx = 0;

    const r = Math.floor(spawnIdx / gridWidth);
    const c = spawnIdx % gridWidth;

    player.pos.x = c * CELL_SIZE + CELL_SIZE / 2;
    player.pos.z = r * CELL_SIZE + CELL_SIZE / 2;
    player.pos.y = player.height;

    player.vel.x = 0;
    player.vel.z = 0;

    // Set Direction
    const cell = mapGrid[spawnIdx];
    const dir = cell.spawnDir || 'N';

    if (dir === 'N') player.yaw = 0;
    else if (dir === 'S') player.yaw = Math.PI;
    else if (dir === 'E') player.yaw = -Math.PI / 2;
    else if (dir === 'W') player.yaw = Math.PI / 2;

    player.pitch = 0;
    player.targetYaw = player.yaw;
    player.targetPitch = player.pitch;

    // Position Camera
    updateCameraPosition();
}

// ========================================================
// 4. USER INPUT CONTROLS & JOYSTICK
// ========================================================
function setupInputControls() {
    // Reset Key States
    keys = { w: false, a: false, s: false, d: false, ctrl: false };

    // 1. Keyboard Listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 2. Mouse Drag-to-Look Listeners
    const canvas = document.getElementById('canvas-3d');
    canvas.addEventListener('click', handleCanvasClick);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    // 3. Touch Drag-to-Look Listeners
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    // 4. Motion / Gyro initialization on first interaction
    window.addEventListener('touchstart', requestGyroPermission, { once: true });
    window.addEventListener('click', requestGyroPermission, { once: true });

    // 4. Click Floor to Move
    canvas.addEventListener('click', handleFloorClick);

    // HUD overlays
    btnMusic.addEventListener('click', toggleMusicBtn);
    btnTour.addEventListener('click', toggleGuidedTour);
    btnHelp.addEventListener('click', toggleHelpModal);
    if (btnCalibrate) btnCalibrate.addEventListener('click', calibrateGyro);
    btnCloseHelp.addEventListener('click', () => controlsHelpModal.classList.add('hidden'));
    btnStopTour.addEventListener('click', stopGuidedTour);
    infoCard.addEventListener('click', handleInfoCardClick);

    // Joystick
    setupTouchJoystick();
}

function removeInputControls() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);

    const canvas = document.getElementById('canvas-3d');
    if (canvas) {
        canvas.removeEventListener('click', handleCanvasClick);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('click', handleFloorClick);
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('pointerlockchange', handlePointerLockChange);

    btnMusic.removeEventListener('click', toggleMusicBtn);
    btnTour.removeEventListener('click', toggleGuidedTour);
    btnHelp.removeEventListener('click', toggleHelpModal);
    if (btnCalibrate) btnCalibrate.removeEventListener('click', calibrateGyro);
    btnStopTour.removeEventListener('click', stopGuidedTour);
    infoCard.removeEventListener('click', handleInfoCardClick);

    // Remove joystick listeners
    removeTouchJoystick();
}

function handleKeyDown(e) {
    if (isTourActive) return; // Disable keyboard movement in tour mode

    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') keys.w = true;
    if (k === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (k === 's' || e.key === 'ArrowDown') keys.s = true;
    if (k === 'd' || e.key === 'ArrowRight') keys.d = true;
    if (e.key === 'Control') keys.ctrl = true;
}

function handleKeyUp(e) {
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (k === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (k === 's' || e.key === 'ArrowDown') keys.s = false;
    if (k === 'd' || e.key === 'ArrowRight') keys.d = false;
    if (e.key === 'Control') keys.ctrl = false;
}

function requestGyroPermission() {
    // Only apply motion controls to mobile/tablet devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ devices
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleDeviceOrientation);
                    enableGyroUI();
                }
            })
            .catch(console.error);
    } else {
        // Non-iOS or older devices
        window.addEventListener('deviceorientation', handleDeviceOrientation);
        enableGyroUI();
    }
}

function enableGyroUI() {
    gyro.enabled = true;
    if (btnCalibrate) btnCalibrate.classList.remove('hidden');
}

function calibrateGyro() {
    // Zero out the tracking offsets so the next movement starts from "now"
    gyro.prevAlpha = null;
    gyro.prevBeta = null;
    gyro.prevGamma = null;
    
    // Level the virtual horizon
    player.targetPitch = 0;
    
    // Provide visual feedback on the button
    btnCalibrate.style.color = 'var(--dev-accent)';
    setTimeout(() => { btnCalibrate.style.color = '#fff'; }, 500);
}

function handleDeviceOrientation(e) {
    if (isTourActive || renderer.xr.isPresenting) return;

    // alpha: rotation around z-axis [0, 360] (Yaw)
    // beta: rotation around x-axis [-180, 180] (Pitch)
    // gamma: rotation around y-axis [-90, 90] (Roll)
    
    // Use rounded integers to eliminate decimal-place sensor noise
    const currentAlpha = Math.round(e.alpha);
    const currentBeta = Math.round(e.beta);
    const currentGamma = Math.round(e.gamma);

    if (gyro.prevAlpha === null) {
        gyro.prevAlpha = currentAlpha;
        gyro.prevBeta = currentBeta;
        gyro.prevGamma = currentGamma;
        return;
    }

    // 1. Calculate Alpha Delta (Yaw when flat)
    let da = currentAlpha - gyro.prevAlpha;
    if (da > 180) da -= 360;
    if (da < -180) da += 360;

    // 2. Calculate Gamma Delta (Yaw when standing)
    let dg = currentGamma - gyro.prevGamma;

    // 3. Calculate Pitch Delta
    const deltaPitch = currentBeta - gyro.prevBeta;

    // 4. The Blend: Mix Alpha and Gamma based on the tilt (Beta)
    // cos(0) = 1 (Flat), sin(90) = 1 (Standing)
    const betaRad = (currentBeta * Math.PI) / 180;
    const blendAlpha = Math.abs(Math.cos(betaRad));
    const blendGamma = Math.abs(Math.sin(betaRad));
    
    // Calculate raw delta
    const rawDeltaYaw = (da * blendAlpha) + (dg * blendGamma);
    const rawDeltaPitch = currentBeta - gyro.prevBeta;

    // 5. Smoothing / Damping
    // Instead of raw jumps, we blend a portion of the new movement.
    // This removes the "decimel jitter" noise better than Math.round alone.
    const smoothing = 0.8; 
    const sensYaw = 0.035;
    const sensPitch = 0.015;

    if (Math.abs(rawDeltaYaw) >= 1) {
        player.targetYaw -= (rawDeltaYaw * sensYaw) * smoothing;
    }
    if (Math.abs(rawDeltaPitch) >= 1) {
        player.targetPitch += (rawDeltaPitch * sensPitch) * smoothing;
    }
    
    // Clamp pitch
    player.targetPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, player.targetPitch));

    gyro.prevAlpha = currentAlpha;
    gyro.prevBeta = currentBeta;
    gyro.prevGamma = currentGamma;
}

function handleCanvasClick(e) {
    const canvas = document.getElementById('canvas-3d');
    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
    } else {
        // If already locked, allow floor clicking to teleport
        handleFloorClick(e);
    }
}

function handlePointerLockChange() {
    const canvas = document.getElementById('canvas-3d');
    if (document.pointerLockElement === canvas) {
        console.log('Pointer lock engaged.');
    } else {
        console.log('Pointer lock released.');
    }
}

function handleMouseMove(e) {
    const canvas = document.getElementById('canvas-3d');
    if (document.pointerLockElement !== canvas) return;

    if (isTourActive) stopGuidedTour();

    // Boosted X-axis sensitivity for mouse
    const sensYaw = 0.0035;
    const sensPitch = 0.002;
    player.targetYaw += e.movementX * sensYaw;
    player.targetPitch -= e.movementY * sensPitch;

    player.targetPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, player.targetPitch));
}

// Touch controls for mobile devices
function handleTouchStart(e) {
    if (e.touches.length === 1) {
        // Drag to look around
        const touch = e.touches[0];

        // Prevent registering joystick starting drag as looking
        const joyBaseRect = joystickBase.getBoundingClientRect();
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        const distToJoy = Math.hypot(touchX - (joyBaseRect.left + 50), touchY - (joyBaseRect.top + 50));

        if (distToJoy > 70) {
            mouse.isDragging = true;
            mouse.x = touch.clientX;
            mouse.y = touch.clientY;
        }
    }
}

function handleTouchMove(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault(); // Stop mobile elastic scroll bouncing

    if (isTourActive) stopGuidedTour();

    const touch = e.touches[0];
    const dx = touch.clientX - mouse.x;
    const dy = touch.clientY - mouse.y;

    mouse.x = touch.clientX;
    mouse.y = touch.clientY;

    // Boosted X-axis sensitivity for touch swipes
    const sensYaw = 0.009;
    const sensPitch = 0.005;
    player.targetYaw += dx * sensYaw;
    player.targetPitch -= dy * sensPitch;
    player.targetPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, player.targetPitch));
}

function handleTouchEnd() {
    mouse.isDragging = false;
}

// Teleport click movement
function handleFloorClick(e) {
    if (document.pointerLockElement && document.pointerLockElement.id !== 'canvas-3d') return;
    if (isTourActive) return;

    // Calculate click normalized device coordinates (-1 to 1)
    const container = document.getElementById('gallery-screen');
    const bounds = container.getBoundingClientRect();

    const mouse2D = new THREE.Vector2();
    mouse2D.x = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse2D.y = -((e.clientY - bounds.top) / bounds.height) * 2 + 1;

    // Create Raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse2D, camera);

    // Intersect floor tiles or paintings
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        // Check what we hit
        const hit = intersects[0];

        // If we hit a floor cell, teleport there smoothly!
        if (hit.object.geometry && hit.object.geometry.type === 'BoxGeometry' && hit.point.y < 0.2) {
            // Calculate which grid cell
            const col = Math.floor(hit.point.x / CELL_SIZE);
            const row = Math.floor(hit.point.z / CELL_SIZE);

            // Safety bounds check
            if (row >= 0 && row < gridHeight && col >= 0 && col < gridWidth) {
                const toIndex = (r, c) => r * gridWidth + c;
                const cell = mapGrid[toIndex(row, col)];

                if (cell.type === 'floor' || cell.type === 'spawn') {
                    // Trigger a smooth slide to the center of that cell
                    const targetX = col * CELL_SIZE + CELL_SIZE / 2;
                    const targetZ = row * CELL_SIZE + CELL_SIZE / 2;

                    animateTeleport(targetX, targetZ);
                }
            }
        }
    }
}

function animateTeleport(tx, tz) {
    let t = 0;
    const sx = player.pos.x;
    const sz = player.pos.z;

    const step = () => {
        t += 0.08;
        if (t >= 1) {
            player.pos.x = tx;
            player.pos.z = tz;
            updateCameraPosition();
        } else {
            // Cubic ease-in-out
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            player.pos.x = sx + (tx - sx) * ease;
            player.pos.z = sz + (tz - sz) * ease;
            updateCameraPosition();
            requestAnimationFrame(step);
        }
    };

    step();
}

// Mobile Virtual Touch Joystick
function setupTouchJoystick() {
    // Show joystick base on touch screens
    const detectTouch = () => {
        joystickContainer.classList.remove('hidden');
        window.removeEventListener('touchstart', detectTouch);
    };
    window.addEventListener('touchstart', detectTouch);

    joystickBase.addEventListener('touchstart', onJoystickStart, { passive: false });
    window.addEventListener('touchmove', onJoystickMove, { passive: false });
    window.addEventListener('touchend', onJoystickEnd);
}

function removeTouchJoystick() {
    joystickBase.removeEventListener('touchstart', onJoystickStart);
    window.removeEventListener('touchmove', onJoystickMove);
    window.removeEventListener('touchend', onJoystickEnd);
}

function onJoystickStart(e) {
    e.preventDefault();
    joystickActive = true;

    if (isTourActive) stopGuidedTour();

    const touch = e.touches[0];
    touchStart.x = touch.clientX;
    touchStart.y = touch.clientY;
}

function onJoystickMove(e) {
    if (!joystickActive) return;
    e.preventDefault();

    // Find touch corresponding to joystick
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;

    const maxDist = 45; // Max movement radius
    const dist = Math.hypot(dx, dy);

    let angle = Math.atan2(dy, dx);
    let moveDist = Math.min(dist, maxDist);

    const knobX = Math.cos(angle) * moveDist;
    const knobY = Math.sin(angle) * moveDist;

    joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    // Normalize moving values (-1 to 1)
    joystickVector.x = knobX / maxDist;
    joystickVector.y = knobY / maxDist;
}

function onJoystickEnd() {
    joystickActive = false;
    joystickKnob.style.transform = 'translate(0px, 0px)';
    joystickVector.x = 0;
    joystickVector.y = 0;
}

function handleInfoCardClick(e) {
    const isMobile = window.innerWidth <= 900;
    if (!isMobile) return;

    // If it's the "?" button, expand it
    if (infoCard.classList.contains('mobile-collapsed')) {
        infoCard.classList.remove('mobile-collapsed');
        return;
    }

    // If expanded, hide it unless clicking the external link/button
    if (e.target.closest('a') || e.target.closest('button')) return;
    
    // Hide completely and revert to "?" button state
    hidePaintingHUD();
}

function adjustHUDForMobile() {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouch) {
        // Hide mouse-specific instructions in the help modal
        const clickInstruct = document.querySelector('.control-item:nth-child(2)');
        const escInstruct = document.querySelector('.control-item:nth-child(3)');
        if (clickInstruct) clickInstruct.style.display = 'none';
        if (escInstruct) escInstruct.style.display = 'none';
    }
}

// Toggle Overlays
function toggleHelpModal() {
    controlsHelpModal.classList.toggle('hidden');
}

// ========================================================
// 5. MOVEMENT, SLIDING COLLISONS & PHYSICS
// ========================================================
function updatePlayerPosition() {
    if (isTourActive) return; // Managed by Guided Tour

    let moveX = 0;
    let moveZ = 0;

    // 1. Gather Keyboard inputs
    if (keys.w) { moveX += Math.sin(player.yaw); moveZ += -Math.cos(player.yaw); }
    if (keys.s) { moveX += -Math.sin(player.yaw); moveZ += Math.cos(player.yaw); }
    if (keys.a) { moveX += -Math.cos(player.yaw); moveZ += -Math.sin(player.yaw); }
    if (keys.d) { moveX += Math.cos(player.yaw); moveZ += Math.sin(player.yaw); }

    // 2. Gather Joystick input
    if (joystickActive) {
        // Forward vector
        const fX = Math.sin(player.yaw);
        const fZ = -Math.cos(player.yaw);
        // Right vector
        const rX = Math.cos(player.yaw);
        const rZ = Math.sin(player.yaw);

        // Combine (joystickVector.y is forward/backward, joystickVector.x is left/right)
        moveX += rX * joystickVector.x - fX * joystickVector.y;
        moveZ += rZ * joystickVector.x - fZ * joystickVector.y;
    }

    // 3. Apply acceleration
    const accel = 0.018;
    const friction = 0.83; // Heavy sliding friction

    if (Math.hypot(moveX, moveZ) > 0) {
        // Normalize movement vector
        const len = Math.hypot(moveX, moveZ);
        player.vel.x += (moveX / len) * accel;
        player.vel.z += (moveZ / len) * accel;
    }

    // Apply friction
    player.vel.x *= friction;
    player.vel.z *= friction;

    // Crouch logic: Smooth eye-level transition
    const targetY = keys.ctrl ? player.crouchHeight : player.height;
    player.pos.y += (targetY - player.pos.y) * 0.15;

    // Don't calculate small velocities
    if (Math.abs(player.vel.x) < 0.001) player.vel.x = 0;
    if (Math.abs(player.vel.z) < 0.001) player.vel.z = 0;

    // 4. Slide-Collision Resolution
    if (player.vel.x !== 0 || player.vel.z !== 0) {
        // Perform collision resolution along X first
        const nextX = player.pos.x + player.vel.x;
        if (!checkWallCollision(nextX, player.pos.z)) {
            player.pos.x = nextX;
        } else {
            player.vel.x = 0; // stop X velocity on impact
        }

        // Perform collision resolution along Z
        const nextZ = player.pos.z + player.vel.z;
        if (!checkWallCollision(player.pos.x, nextZ)) {
            player.pos.z = nextZ;
        } else {
            player.vel.z = 0; // stop Z velocity
        }

        // Keep inside bounds
        player.pos.x = Math.max(player.radius, Math.min(gridWidth * CELL_SIZE - player.radius, player.pos.x));
        player.pos.z = Math.max(player.radius, Math.min(gridHeight * CELL_SIZE - player.radius, player.pos.z));
    }
}

function checkWallCollision(px, pz) {
    const toIndex = (r, c) => r * gridWidth + c;

    // Check all neighboring cells surrounding player position
    const cellCol = Math.floor(px / CELL_SIZE);
    const cellRow = Math.floor(pz / CELL_SIZE);

    // Scan 3x3 cells grid centered on player
    for (let r = cellRow - 1; r <= cellRow + 1; r++) {
        for (let c = cellCol - 1; c <= cellCol + 1; c++) {
            if (r >= 0 && r < gridHeight && c >= 0 && c < gridWidth) {
                const cell = mapGrid[toIndex(r, c)];
                if (cell.type === 'wall' || cell.type === 'art') {
                    // Check bounding circle vs bounding square box
                    const wallLeft = c * CELL_SIZE;
                    const wallRight = wallLeft + CELL_SIZE;
                    const wallTop = r * CELL_SIZE;
                    const wallBottom = wallTop + CELL_SIZE;

                    // Find closest point inside box to circle center
                    const closestX = Math.max(wallLeft, Math.min(px, wallRight));
                    const closestZ = Math.max(wallTop, Math.min(pz, wallBottom));

                    // Distance between closest point and player circle center
                    const dx = px - closestX;
                    const dz = pz - closestZ;
                    const distSq = dx * dx + dz * dz;

                    if (distSq < player.radius * player.radius) {
                        return true; // Overlap detected!
                    }
                }
            }
        }
    }
    return false;
}

function updateCameraPosition() {
    // If not in VR, we manually set camera position. 
    // In VR, Three.js handles camera.position based on the headset/phone tracking.
    if (!renderer.xr.isPresenting) {
        playerGroup.position.set(player.pos.x, player.pos.y, player.pos.z);

        // Derive Target Look vector from Yaw and Pitch
        const target = new THREE.Vector3();
        target.x = player.pos.x + Math.sin(player.yaw) * Math.cos(player.pitch);
        target.z = player.pos.z - Math.cos(player.yaw) * Math.cos(player.pitch);
        target.y = player.pos.y + Math.sin(player.pitch);

        camera.lookAt(target);
    } else {
        // In VR, move the group (the entire virtual world origin)
        playerGroup.position.set(player.pos.x, 0, player.pos.z);
    }
}

// ========================================================
// 6. DETECT PAINTING PROXIMITY & HUD INFO
// ========================================================
let currentNearbyPainting = null;

function checkPaintingProximity() {
    if (isTourActive) return; // Banner handles Guided Tour HUD

    let closestPainting = null;
    let minDist = 3.8; // Open details inside 3.8 units radius

    interactivePaintings.forEach(p => {
        const dx = player.pos.x - p.mesh.position.x;
        const dz = player.pos.z - p.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < minDist) {
            minDist = dist;
            closestPainting = p;
        }
    });

    if (closestPainting) {
        if (currentNearbyPainting !== closestPainting) {
            currentNearbyPainting = closestPainting;
            showPaintingHUD(closestPainting.data);
        }
    } else {
        if (currentNearbyPainting !== null) {
            currentNearbyPainting = null;
            hidePaintingHUD();
        }
    }
}

function showPaintingHUD(artData) {
    detailTitle.textContent = artData.title;
    detailSubtitle.textContent = artData.subtitle;
    detailDesc.textContent = artData.description;

    // Stylize based on type
    if (artData.type === 'developer') {
        detailBadge.textContent = 'Software Project';
        infoCard.classList.add('dev-card-style');
    } else {
        detailBadge.textContent = 'Creative Work';
        infoCard.classList.remove('dev-card-style');
    }

    // Configure Instagram/Github external link
    if (artData.link && artData.link !== '#') {
        detailLink.href = artData.link;
        detailLink.querySelector('span').textContent = artData.type === 'developer' ? 'View Code Repository' : 'View on Instagram';
        detailLinkContainer.classList.remove('hidden');
    } else {
        detailLinkContainer.classList.add('hidden');
    }

    infoCard.classList.remove('hidden');
}

function hidePaintingHUD() {
    infoCard.classList.add('hidden');
}

// ========================================================
// 7. CINEMATIC GUIDED TOUR
// ========================================================
function toggleGuidedTour() {
    if (isTourActive) {
        stopGuidedTour();
    } else {
        startGuidedTour();
    }
}

function startGuidedTour() {
    if (interactivePaintings.length === 0) {
        alert("Please add at least one Artwork Wall cell to the map to enjoy the guided tour!");
        return;
    }

    isTourActive = true;
    currentTourStopIdx = 0;
    tourState = 'flying';
    tourLerpTime = 0;

    // Hide standard help or panels
    controlsHelpModal.classList.add('hidden');
    infoCard.classList.add('hidden');
    tourBanner.classList.remove('hidden');

    btnTour.classList.add('active');
    btnTour.querySelector('span:not(.material-icons)').textContent = 'Cancel Tour';

    // Assemble tour stop points (find floor coordinate facing the painting face!)
    tourStops = [];

    interactivePaintings.forEach(p => {
        // Determine player coordinate in front of painting
        let fx = p.mesh.position.x;
        let fz = p.mesh.position.z;
        let yaw = 0;

        const faceDist = 3.6; // Stand 3.6 units back

        if (p.faceDirection === 'N') {
            fz -= faceDist;
            yaw = 0; // Look South? No, looking North at the wall!
            yaw = Math.PI; // Face North
        } else if (p.faceDirection === 'S') {
            fz += faceDist;
            yaw = 0; // Face South
        } else if (p.faceDirection === 'E') {
            fx += faceDist;
            yaw = -Math.PI / 2; // Face East
        } else if (p.faceDirection === 'W') {
            fx -= faceDist;
            yaw = Math.PI / 2; // Face West
        }

        tourStops.push({
            pos: { x: fx, z: fz },
            yaw: yaw,
            data: p.data
        });
    });
}

function stopGuidedTour() {
    if (!isTourActive) return;

    isTourActive = false;
    tourBanner.classList.add('hidden');
    infoCard.classList.add('hidden');

    btnTour.classList.remove('active');
    btnTour.querySelector('span:not(.material-icons)').textContent = 'Guided Tour';

    // Smooth release pitch/yaw
    player.targetYaw = player.yaw;
    player.targetPitch = player.pitch;
}

function updateGuidedTour() {
    if (!isTourActive || tourStops.length === 0) return;

    const stop = tourStops[currentTourStopIdx];

    if (tourState === 'flying') {
        // Fly player smoothly to stop position and orient camera look angle
        tourLerpTime += TOUR_SPEED;

        // Easing interpolation
        const t = Math.min(1, tourLerpTime);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // Quad ease-in-out

        // Interpolate Position
        player.pos.x = player.pos.x + (stop.pos.x - player.pos.x) * ease;
        player.pos.z = player.pos.z + (stop.pos.z - player.pos.z) * ease;
        player.pos.y = player.height;

        // Interpolate Yaw angle correctly (unwrap rotation wrap arounds)
        let diffYaw = stop.yaw - player.yaw;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        player.yaw += diffYaw * ease;

        // Interpolate pitch to level horizon
        player.pitch += (0 - player.pitch) * ease;

        updateCameraPosition();

        // Check arrival
        if (t >= 1) {
            tourState = 'viewing';
            tourViewStartTime = Date.now();
            showPaintingHUD(stop.data);
        }
    }
    else if (tourState === 'viewing') {
        // Hold still at the artwork, let details overlay stay visible
        const elapsed = Date.now() - tourViewStartTime;

        if (elapsed > 5500) { // Admire painting for 5.5s
            // Hide panel & transition to next slide
            hidePaintingHUD();

            currentTourStopIdx = (currentTourStopIdx + 1) % tourStops.length;
            tourState = 'flying';
            tourLerpTime = 0;
        }
    }
}

// ========================================================
// 8. PROCEDURAL AMBIENT SYNTHESIZER
// ========================================================
function toggleMusicBtn() {
    if (isMusicPlaying) {
        stopSynthesizer();
        btnMusic.querySelector('span').textContent = 'volume_off';
        btnMusic.classList.remove('active');
        isMusicPlaying = false;
    } else {
        startSynthesizer();
        btnMusic.querySelector('span').textContent = 'volume_up';
        btnMusic.classList.add('active');
        isMusicPlaying = true;
    }
}

function startSynthesizer() {
    if (audioCtx === null) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Play relaxing procedural synth chords (1 chord every 6 seconds)
    const chords = [
        [60, 64, 67, 71], // Cmaj7 (C4, E4, G4, B4)
        [57, 60, 64, 67], // Am7   (A3, C4, E4, G4)
        [53, 57, 60, 64], // Fmaj7 (F3, A3, C4, E4)
        [55, 59, 62, 65]  // G7    (G3, B3, D4, F4)
    ];

    let chordIdx = 0;

    const playChord = () => {
        const notes = chords[chordIdx];
        chordIdx = (chordIdx + 1) % chords.length;

        const now = audioCtx.currentTime;
        const duration = 6.0; // Play duration 6s

        notes.forEach(note => {
            const freq = Math.pow(2, (note - 69) / 12) * 440;

            // Oscillator
            const osc = audioCtx.createOscillator();
            osc.type = 'triangle'; // Smooth mellow sound
            osc.frequency.setValueAtTime(freq, now);

            // Subtle vibrato LFO
            const lfo = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();
            lfo.frequency.setValueAtTime(3.5, now); // LFO Speed 3.5Hz
            lfoGain.gain.setValueAtTime(1.5, now);  // Pitch deviation 1.5Hz

            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // Low-pass Filter for dark warm sound
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, now);
            filter.Q.setValueAtTime(1.0, now);

            // Gain envelope (long attack/decay)
            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.04, now + 2.0); // 2s Fade In
            gainNode.gain.setValueAtTime(0.04, now + duration - 2.0);
            gainNode.gain.linearRampToValueAtTime(0, now + duration);  // 2s Fade Out

            // Connections
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            // Play
            osc.start(now);
            lfo.start(now);

            osc.stop(now + duration);
            lfo.stop(now + duration);

            // Keep track for clean disposal
            activeSynthNodes.push({ osc, lfo, gainNode });
        });
    };

    // Play immediately
    playChord();

    // Set interval
    synthInterval = setInterval(playChord, 6000);
}

function stopSynthesizer() {
    if (synthInterval) {
        clearInterval(synthInterval);
        synthInterval = null;
    }

    activeSynthNodes.forEach(node => {
        try {
            node.osc.stop();
            node.lfo.stop();
        } catch (e) { }
    });
    activeSynthNodes = [];
}

// ========================================================
// 9. ANIMATE ENGINE & UPDATE
// ========================================================
function animate() {
    if (isTourActive) {
        updateGuidedTour();
    } else {
        // Smooth camera look lerp (Inertia effect)
        const lerpSpeed = 0.12;
        player.yaw += (player.targetYaw - player.yaw) * lerpSpeed;
        player.pitch += (player.targetPitch - player.pitch) * lerpSpeed;

        // Physics update
        updatePlayerPosition();

        // Render update
        updateCameraPosition();

        // Check paintings distance to show details
        checkPaintingProximity();
    }

    // Three.js Render frame
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function handleWindowResize() {
    if (!renderer || !camera) return;

    const container = document.getElementById('gallery-screen');
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}
