/* assets/js/gallery-editor.js */
import { start3DGallery, stop3DGallery } from './gallery-3d.js';

// Application State
let artworks = []; // Mapped list of all available artworks
let gridWidth = 8;
let gridHeight = 8;
let grid = []; // 1D array representing the grid
let activeTool = 'floor'; // 'floor', 'wall', 'art', 'spawn'
let selectedCellIndex = null;
let activeTab = 'creative'; // 'creative' or 'developer'
let isDrawing = false; // For click-and-drag grid placement
let selectedIndices = [];
let isMoveMode = false;

// History State
let undoStack = [];
let redoStack = [];

// Zoom & Pan State
let gridZoom = 1.0;
let gridPan = { x: 0, y: 0 };
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };
let isSpaceDown = false;

let layoutFromFile = null; // Store layout from data.json
let activeFace = 'N'; // 'N', 'S', 'E', 'W'

// DOM Elements
const gridEl = document.getElementById('editor-grid');
const toolBtns = {
    floor: document.getElementById('tool-floor'),
    wall: document.getElementById('tool-wall'),
    art: document.getElementById('tool-art'),
    spawn: document.getElementById('tool-spawn'),
    select: document.getElementById('tool-select')
};

const gridViewContainer = document.getElementById('grid-view-container');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');

const inputGridWidth = document.getElementById('input-grid-width');
const inputGridHeight = document.getElementById('input-grid-height');
const btnResizeGrid = document.getElementById('btn-resize-grid');
const btnRotateLayout = document.getElementById('btn-rotate-layout');

const btnClear = document.getElementById('btn-clear');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnMoveSelection = document.getElementById('btn-move-selection');
const btnClearSelection = document.getElementById('btn-clear-selection');
const btnResetFile = document.getElementById('btn-reset-file');
const btnExport = document.getElementById('btn-export');
const btnLaunch = document.getElementById('btn-launch');
const btnEdit = document.getElementById('btn-edit');
const artConfigPanel = document.getElementById('art-config-panel');
const artConfigPlaceholder = document.getElementById('art-config-placeholder');
const artConfigActive = document.getElementById('art-config-active');
const selectedCellCoords = document.getElementById('selected-cell-coords');
const tabCreative = document.getElementById('tab-creative');
const tabDeveloper = document.getElementById('tab-developer');
const artworkPickerList = document.getElementById('artwork-picker-list');
const statArtCount = document.getElementById('stat-art-count');
const statSpawnSet = document.getElementById('stat-spawn-set');
const statGridSize = document.getElementById('stat-grid-size');

// Presets DOM
const presetBtns = {
    hall: document.getElementById('preset-hall'),
    spiral: document.getElementById('preset-spiral'),
    corridors: document.getElementById('preset-corridors')
};

// ========================================================
// 1. DATA INITIALIZATION & LOADING
// ========================================================
async function loadArtworksData() {
    try {
        const response = await fetch('./data.json');
        if (!response.ok) throw new Error('Failed to load portfolio data');
        const data = await response.json();
        
        if (data.galleryLayout) {
            if (!Array.isArray(data.galleryLayout) && data.galleryLayout.cells) {
                // New format: { width, height, cells }
                layoutFromFile = {
                    width: data.galleryLayout.width,
                    height: data.galleryLayout.height,
                    cells: data.galleryLayout.cells
                };
            } else {
                // Fallback: Old array format
                const side = Math.sqrt(data.galleryLayout.length);
                const s = Number.isInteger(side) ? side : 8;
                layoutFromFile = {
                    width: s,
                    height: s,
                    cells: data.galleryLayout
                };
            }
            
            // Set initial session dimensions
            gridWidth = layoutFromFile.width;
            gridHeight = layoutFromFile.height;
        }

        mapArtworks(data);
        loadGridState();
        initializeGrid();
        renderArtworkPicker();
        updateStats();

        const hasSpawn = grid.some(c => c.type === 'spawn');
        if (hasSpawn) {
            start3DGallery(grid, artworks, gridWidth, gridHeight);
        }
        
        // Remove loader once app is initialized
        setTimeout(() => {
            const loader = document.getElementById('loading-overlay');
            if (loader) loader.classList.add('fade-out');
        }, 800);
        
    } catch (err) {
        console.error('Error loading gallery details:', err);
        alert('Could not load portfolio data.json. Using fallback mock artworks.');
        loadFallbackArtworks();
        loadGridState();
        initializeGrid();
        renderArtworkPicker();
        updateStats();
    }
}

function mapArtworks(data) {
    artworks = [];
    
    // 1. Map Creative Artworks (gallery)
    if (data.creative && data.creative.gallery) {
        data.creative.gallery.forEach((imgSrc, index) => {
            // Check if this is the highlighted art
            let title = `Artwork ${index + 1}`;
            let desc = data.creative.passion || "Digital painting exploring color and emotion.";
            let link = data.creative.links ? data.creative.links.instagram : '#';
            let subtitle = "Photoshop";
            
            // Format nice details for specific file names based on filename
            const filename = imgSrc.split('/').pop().split('.')[0];
            
            if (index === 0 && data.creative.highlightTitle) {
                title = data.creative.highlightTitle;
                desc = data.creative.highlightDescription || desc;
                link = data.creative.highlightLink || link;
            } else {
                // Generate elegant titles based on the file naming
                title = filename
                    .replace(/IG-/g, '')
                    .replace(/_bw/g, ' (Mono)')
                    .replace(/([A-Z])/g, ' $1') // Camel case to spaces
                    .trim();
                title = title.charAt(0).toUpperCase() + title.slice(1);
                
                // Add soft details
                if (title.toLowerCase().includes('guitar')) {
                    subtitle = "Procreate Sketch";
                    desc = "Melody in solitude, exploring acoustic vibes and digital brushwork.";
                } else if (title.toLowerCase().includes('smoke') || title.toLowerCase().includes('train')) {
                    subtitle = "Traditional Charcoal & Photoshop";
                    desc = "A study of atmospheric steam and mechanical elements in a classic train station.";
                } else if (title.toLowerCase().includes('nightwalk') || title.toLowerCase().includes('walk')) {
                    subtitle = "Procreate digital art";
                    desc = "Vibrant neon reflections mirroring along wet asphalt pavements during a midnight walk.";
                } else if (title.toLowerCase().includes('girl') || title.toLowerCase().includes('woman')) {
                    subtitle = "Portrait Painting";
                    desc = "A digital realism portrait emphasizing lighting contrasts and soft textures.";
                } else {
                    subtitle = "Photoshop Creative Suite";
                    desc = "Expressive concept art detailing themes of modern isolation and creative freedom.";
                }
            }
            
            artworks.push({
                id: `creative_${index}`,
                title: title,
                subtitle: subtitle,
                image: imgSrc,
                type: 'creative',
                description: desc,
                link: link
            });
        });
    }
    
    // 2. Map Developer Projects
    if (data.developer && data.developer.projects) {
        data.developer.projects.forEach((proj, projIdx) => {
            if (proj.images && proj.images.length > 0) {
                proj.images.forEach((imgSrc, imgIdx) => {
                    artworks.push({
                        id: `dev_${projIdx}_${imgIdx}`,
                        title: `${proj.title} (Slide ${imgIdx + 1})`,
                        subtitle: proj.subtitle || "Software Engineering",
                        image: imgSrc,
                        type: 'developer',
                        description: proj.description || "Interactive software architecture demonstration.",
                        link: data.profile && data.profile.links ? data.profile.links.github : '#'
                    });
                });
            }
        });
    }
}

function loadFallbackArtworks() {
    artworks = [];
    // Inject mock content in case data.json loading fails entirely
    for (let i = 1; i <= 6; i++) {
        artworks.push({
            id: `creative_${i}`,
            title: `Creative Masterpiece #${i}`,
            subtitle: "Digital Design",
            image: `https://picsum.photos/800/600?random=${i}`,
            type: 'creative',
            description: "A beautiful exploration of color, light, and geometry generated for virtual staging.",
            link: "https://instagram.com"
        });
        artworks.push({
            id: `dev_${i}`,
            title: `Software Architecture Mock #${i}`,
            subtitle: "Full Stack Development",
            image: `https://picsum.photos/800/600?random=${i + 10}`,
            type: 'developer',
            description: "Interactive visual diagram showcasing advanced engineering, responsive interfaces, and full database schemas.",
            link: "https://github.com"
        });
    }
}

// ========================================================
// 2. GRID CONTROLLER & EVENTS
// ========================================================
function loadGridState() {
    const savedGrid = localStorage.getItem('gallery_3d_grid');
    if (savedGrid) {
        try {
            const data = JSON.parse(savedGrid);
            if (data.cells && data.width && data.height) {
                gridWidth = data.width;
                gridHeight = data.height;
                grid = data.cells;
            } else if (Array.isArray(data)) {
                // Fallback for old 8x8 format
                grid = data;
                gridWidth = 8;
                gridHeight = 8;
            }
        } catch (e) {
            console.warn('Could not parse local grid cache. Loading default preset.', e);
            grid = loadDefaultLayout();
        }
    } else {
        grid = loadDefaultLayout();
    }
}

function initializeGrid() {
    gridEl.innerHTML = '';

    if (inputGridWidth) inputGridWidth.value = gridWidth;
    if (inputGridHeight) inputGridHeight.value = gridHeight;

    updateGridStyle();

    // Render the grid cells in HTML based on current dimensions
    for (let i = 0; i < grid.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = i;
        
        applyCellVisuals(cell, grid[i]);
        
        // Mouse Down - Start placing/drawing
        cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDrawing = true;
            handleCellClick(i);
        });
        
        // Mouse Enter - Drag placement
        cell.addEventListener('mouseenter', () => {
            if (isDrawing && activeTool !== 'spawn' && activeTool !== 'art') {
                handleCellClick(i, true); // true = silent/drag mode
            }
            if (isMoveMode) {
                showMovePreview(i);
            }
        });
        
        gridEl.appendChild(cell);
    }
    
    // Drag Stop
    window.addEventListener('mouseup', () => {
        isDrawing = false;
    });

    gridEl.addEventListener('mouseleave', clearMovePreview);

    updateGridTransform();
}

function updateGridStyle() {
    if (!gridEl) return;
    gridEl.style.gridTemplateColumns = `repeat(${gridWidth}, 65px)`;
    gridEl.style.gridTemplateRows = `repeat(${gridHeight}, 65px)`;
    gridEl.style.width = 'max-content'; // Ensure container expands to fit new columns
}

function resizeGrid(newWidth, newHeight) {
    pushState();
    const newGrid = [];
    for (let r = 0; r < newHeight; r++) {
        for (let c = 0; c < newWidth; c++) {
            const oldIdx = r * gridWidth + c;
            if (r < gridHeight && c < gridWidth && grid[oldIdx]) {
                newGrid.push(grid[oldIdx]);
            } else {
                newGrid.push({ type: 'floor' });
            }
        }
    }
    grid = newGrid;
    gridWidth = newWidth;
    gridHeight = newHeight;

    saveGridState();
    initializeGrid();
    updateStats();
}

function showMovePreview(anchorIndex) {
    clearMovePreview();
    if (!isMoveMode || selectedIndices.length === 0) return;

    let minR = Infinity, minC = Infinity;
    selectedIndices.forEach(idx => {
        minR = Math.min(minR, Math.floor(idx / gridWidth));
        minC = Math.min(minC, idx % gridWidth);
    });

    const tr = Math.floor(anchorIndex / gridWidth);
    const tc = anchorIndex % gridWidth;

    selectedIndices.forEach(idx => {
        const r = Math.floor(idx / gridWidth);
        const c = idx % gridWidth;
        const nr = tr + (r - minR);
        const nc = tc + (c - minC);

        if (nr >= 0 && nr < gridHeight && nc >= 0 && nc < gridWidth) {
            const targetIdx = nr * gridWidth + nc;
            const cellEl = gridEl.querySelector(`[data-index="${targetIdx}"]`);
            if (cellEl) cellEl.classList.add('preview-replace');
        }
    });
}

function clearMovePreview() {
    const previews = gridEl.querySelectorAll('.preview-replace');
    previews.forEach(el => el.classList.remove('preview-replace'));
}

function moveSelectedCells(targetIndex) {
    if (selectedIndices.length === 0) return;
    
    pushState();
    clearMovePreview();

    // 1. Calculate bounding box of selection to determine relative offsets
    let minR = Infinity, minC = Infinity;
    selectedIndices.forEach(idx => {
        const r = Math.floor(idx / gridWidth);
        const c = idx % gridWidth;
        minR = Math.min(minR, r);
        minC = Math.min(minC, c);
    });

    // 2. Clone the selection data
    const movingData = selectedIndices.map(idx => {
        const r = Math.floor(idx / gridWidth);
        const c = idx % gridWidth;
        return {
            offsetR: r - minR,
            offsetC: c - minC,
            data: JSON.parse(JSON.stringify(grid[idx]))
        };
    });

    // 3. Target reference position (where the user clicked)
    const tr = Math.floor(targetIndex / gridWidth);
    const tc = targetIndex % gridWidth;

    // 4. Remove source cells (set to floor)
    selectedIndices.forEach(idx => {
        grid[idx] = { type: 'floor' };
    });

    // 5. Place at destination
    movingData.forEach(item => {
        const nr = tr + item.offsetR;
        const nc = tc + item.offsetC;
        if (nr >= 0 && nr < gridHeight && nc >= 0 && nc < gridWidth) {
            grid[nr * gridWidth + nc] = item.data;
        }
    });

    // 6. Finalize: Re-render the whole grid to reflect moves
    initializeGrid();
    selectedIndices = [];
    isMoveMode = false;
    if (btnMoveSelection) btnMoveSelection.classList.remove('active');
    saveGridState();
    updateStats();
}

function rotateLayout() {
    pushState();
    const newGrid = new Array(gridWidth * gridHeight);
    const newWidth = gridHeight;
    const newHeight = gridWidth;
    const dirMap = { 'N': 'E', 'E': 'S', 'S': 'W', 'W': 'N' };

    for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
            const oldIdx = r * gridWidth + c;
            const newR = c;
            const newC = (gridHeight - 1) - r;
            const newIdx = newR * newWidth + newC;

            const cell = JSON.parse(JSON.stringify(grid[oldIdx]));

            if (cell.artIds) {
                const newArtIds = {};
                Object.keys(cell.artIds).forEach(oldDir => {
                    newArtIds[dirMap[oldDir]] = cell.artIds[oldDir];
                });
                cell.artIds = newArtIds;
            }

            if (cell.type === 'spawn' && cell.spawnDir) {
                cell.spawnDir = dirMap[cell.spawnDir];
            }

            newGrid[newIdx] = cell;
        }
    }

    grid = newGrid;
    gridWidth = newWidth;
    gridHeight = newHeight;

    saveGridState();
    initializeGrid();
    updateStats();
}

// History Management
function pushState() {
    const state = JSON.stringify({
        width: gridWidth,
        height: gridHeight,
        cells: grid
    });
    undoStack.push(state);
    if (undoStack.length > 50) undoStack.shift(); // Max 50 steps
    redoStack = []; // Clear redo when new action happens
}

function undo() {
    if (undoStack.length === 0) return;
    const currentState = JSON.stringify({
        width: gridWidth,
        height: gridHeight,
        cells: grid
    });
    redoStack.push(currentState);
    
    const state = JSON.parse(undoStack.pop());
    restoreState(state);
}

function redo() {
    if (redoStack.length === 0) return;
    const currentState = JSON.stringify({
        width: gridWidth,
        height: gridHeight,
        cells: grid
    });
    undoStack.push(currentState);
    
    const state = JSON.parse(redoStack.pop());
    restoreState(state);
}

function restoreState(state) {
    gridWidth = state.width;
    gridHeight = state.height;
    grid = state.cells;
    initializeGrid();
    updateStats();
    saveGridState();
}

function updateGridTransform() {
    if (!gridEl) return;
    gridEl.style.transform = `translate(${gridPan.x}px, ${gridPan.y}px) scale(${gridZoom})`;
}

function loadDefaultLayout() {
    if (layoutFromFile) {
        // Re-apply the file dimensions during a reset
        gridWidth = layoutFromFile.width;
        gridHeight = layoutFromFile.height;
        return JSON.parse(JSON.stringify(layoutFromFile.cells)); // Deep copy cells
    } else {
        gridWidth = 8;
        gridHeight = 8;
        return generatePreset('hall');
    }
}

function handleCellClick(index, isDrag = false) {
    // Ignore clicks if we are currently panning
    if (isSpaceDown || isPanning) return;

    if (isMoveMode) {
        moveSelectedCells(index);
        return;
    }
    
    if (activeTool !== 'select') pushState();

    const previousType = grid[index].type;
    
    if (activeTool === 'spawn') {
        // Clear previous spawn point
        const prevSpawnIdx = grid.findIndex(c => c.type === 'spawn');
        if (prevSpawnIdx !== -1) {
            grid[prevSpawnIdx] = { type: 'floor' };
            const prevCellEl = gridEl.querySelector(`[data-index="${prevSpawnIdx}"]`);
            applyCellVisuals(prevCellEl, grid[prevSpawnIdx]);
        }
        
        // Place new spawn point
        grid[index] = { type: 'spawn', spawnDir: 'N' };
        selectedCellIndex = null;
        closeArtPanel();
    } 
    else if (activeTool === 'select') {
        if (isDrag) {
            if (!selectedIndices.includes(index)) {
                selectedIndices.push(index);
            }
        } else {
            // Toggle
            const pos = selectedIndices.indexOf(index);
            if (pos === -1) selectedIndices.push(index);
            else selectedIndices.splice(pos, 1);
        }
        const cellEl = gridEl.querySelector(`[data-index="${index}"]`);
        applyCellVisuals(cellEl, grid[index]);
        return;
    }
    else if (activeTool === 'art') {
        if (isDrag) return; // Don't drag-place art walls
        
        // If not already an art wall, set it to unassigned
        if (grid[index].type !== 'art') {
            grid[index] = { type: 'art', artIds: {} };
        }
        
        selectCell(index);
    } 
    else {
        // Floor or Plain Wall
        grid[index] = { type: activeTool };
        
        // If we replaced a selected cell, close panel
        if (selectedCellIndex === index) {
            selectedCellIndex = null;
            closeArtPanel();
        }
    }
    
    // Save to Cache & Render
    saveGridState();
    const cellEl = gridEl.querySelector(`[data-index="${index}"]`);
    applyCellVisuals(cellEl, grid[index]);
    updateStats();
}

function selectCell(index) {
    // Remove previous selection highlight
    if (selectedCellIndex !== null) {
        const prevSelected = gridEl.querySelector(`[data-index="${selectedCellIndex}"]`);
        if (prevSelected) prevSelected.classList.remove('selected');
    }
    
    selectedCellIndex = index;
    const cellEl = gridEl.querySelector(`[data-index="${index}"]`);
    if (cellEl) cellEl.classList.add('selected');
    
    // Open right panel
    openArtPanel(index);
}

function applyCellVisuals(element, cellData) {
    // Clear all cell classes and inner elements
    element.className = 'grid-cell';
    element.innerHTML = '';
    
    // Apply specific classes
    if (cellData.type === 'floor') {
        element.classList.add('cell-floor');
    } 
    else if (cellData.type === 'wall') {
        element.classList.add('cell-wall');
    } 
    else if (cellData.type === 'spawn') {
        element.classList.add('cell-spawn');
        
        // Insert small direction indicator
        const indicator = document.createElement('div');
        indicator.className = 'grid-cell-spawn-indicator';
        indicator.innerHTML = '<span class="material-icons">navigation</span>';
        element.appendChild(indicator);
    } 
    else if (cellData.type === 'art') {
        element.classList.add('cell-art');
        
        // Add directional markers for assigned faces
        const markerOverlay = document.createElement('div');
        markerOverlay.className = 'cell-marker-overlay';
        
        ['N', 'S', 'E', 'W'].forEach(f => {
            const artId = (cellData.artIds || {})[f];
            if (artId) {
                const marker = document.createElement('div');
                marker.className = `face-marker marker-${f.toLowerCase()}`;
                
                const art = artworks.find(a => a.id === artId);
                if (art) {
                    const thumb = document.createElement('img');
                    thumb.src = art.image;
                    thumb.className = 'marker-thumb';
                    marker.appendChild(thumb);

                    if (art.type === 'developer') {
                        marker.classList.add('dev-marker');
                    }
                }

                const label = document.createElement('span');
                label.className = 'marker-label';
                label.textContent = f;
                marker.appendChild(label);
                
                markerOverlay.appendChild(marker);
            }
        });
        element.appendChild(markerOverlay);

        // Show a preview of the first assigned face we find
        const firstFaceId = Object.values(cellData.artIds || {}).find(id => id !== null);
        if (firstFaceId) {
            const art = artworks.find(a => a.id === firstFaceId);
            if (art) {
                const img = document.createElement('img');
                img.className = 'grid-art-thumb';
                img.src = art.image;
                element.appendChild(img);
            } else {
                element.classList.add('unassigned');
            }
        } else {
            element.classList.add('unassigned');
        }
    }
    
    // Maintain selection state
    if (selectedCellIndex === parseInt(element.dataset.index)) {
        element.classList.add('selected');
    }

    // Multi-selection state
    if (selectedIndices.includes(parseInt(element.dataset.index))) {
        element.classList.add('multi-selected');
    }
}

function saveGridState() {
    const state = {
        width: gridWidth,
        height: gridHeight,
        cells: grid
    };
    localStorage.setItem('gallery_3d_grid', JSON.stringify(state));
}

// ========================================================
// 3. PRESET LAYOUTS
// ========================================================
function loadPreset(name) {
    gridWidth = 8;
    gridHeight = 8;
    if (inputGridWidth) inputGridWidth.value = 8;
    if (inputGridHeight) inputGridHeight.value = 8;

    grid = generatePreset(name);
    // Auto-distribute existing artworks to the blank art cells
    distributeArtworksToEmptySlots();
}

function generatePreset(name) {
    const newGrid = [];
    const rows = 8;
    const cols = 8;
    const toIndex = (r, c) => r * cols + c;

    // Presets are designed for 8x8
    for (let i = 0; i < 64; i++) {
        newGrid.push({ type: 'floor' });
    }
    
    if (name === 'hall') {
        // Preset 1: The Grand Hall
        // Outer boundaries are walls
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
                    newGrid[toIndex(r, c)] = { type: 'wall' };
                }
            }
        }
        
        // Central pillars to hold master artworks
        newGrid[toIndex(2, 2)] = { type: 'art', artIds: {} };
        newGrid[toIndex(2, 5)] = { type: 'art', artIds: {} };
        newGrid[toIndex(5, 2)] = { type: 'art', artIds: {} };
        newGrid[toIndex(5, 5)] = { type: 'art', artIds: {} };
        
        // Add wall frames along borders
        newGrid[toIndex(0, 2)] = { type: 'art', artIds: {} };
        newGrid[toIndex(0, 5)] = { type: 'art', artIds: {} };
        newGrid[toIndex(3, 0)] = { type: 'art', artIds: {} };
        newGrid[toIndex(4, 0)] = { type: 'art', artIds: {} };
        newGrid[toIndex(3, 7)] = { type: 'art', artIds: {} };
        newGrid[toIndex(4, 7)] = { type: 'art', artIds: {} };
        newGrid[toIndex(7, 2)] = { type: 'art', artIds: {} };
        newGrid[toIndex(7, 5)] = { type: 'art', artIds: {} };
        
        // Spawn point at bottom center
        newGrid[toIndex(6, 3)] = { type: 'spawn', spawnDir: 'N' };
    } 
    else if (name === 'spiral') {
        // Preset 2: Spiral Exhibition
        // Spiral labyrinth
        const walls = [
            // Outer ring
            [0,0], [0,1], [0,2], [0,3], [0,4], [0,5], [0,6], [0,7],
            [1,7], [2,7], [3,7], [4,7], [5,7], [6,7], [7,7],
            [7,6], [7,5], [7,4], [7,3], [7,2], [7,1], [7,0],
            [6,0], [5,0], [4,0], [3,0], [2,0],
            // Inner ring 1
            [2,2], [2,3], [2,4], [2,5],
            [3,5], [4,5], [5,5],
            [5,4], [5,2],
            [4,2],
        ];
        
        walls.forEach(([r, c]) => {
            newGrid[toIndex(r, c)] = { type: 'wall' };
        });
        
        // Place Art walls at the spiral turns
        newGrid[toIndex(0, 3)] = { type: 'art', artIds: {} };
        newGrid[toIndex(3, 7)] = { type: 'art', artIds: {} };
        newGrid[toIndex(7, 4)] = { type: 'art', artIds: {} };
        newGrid[toIndex(2, 4)] = { type: 'art', artIds: {} };
        newGrid[toIndex(5, 3)] = { type: 'art', artIds: {} };
        
        // Ultimate center masterpiece
        newGrid[toIndex(3, 3)] = { type: 'art', artIds: {} };
        
        // Spawn at outer entryway
        newGrid[toIndex(1, 0)] = { type: 'spawn', spawnDir: 'E' };
    } 
    else if (name === 'corridors') {
        // Preset 3: Winding Corridors (Double S-curve)
        const walls = [
            // Row 0
            [0,0], [0,1], [0,2], [0,3], [0,4], [0,5], [0,6], [0,7],
            // Row 2 partition
            [2,0], [2,1], [2,2], [2,3], [2,4], [2,5],
            // Row 4 partition
            [4,2], [4,3], [4,4], [4,5], [4,6], [4,7],
            // Row 6 partition
            [6,0], [6,1], [6,2], [6,3], [6,4], [6,5],
            // Bottom Row
            [7,0], [7,1], [7,2], [7,3], [7,4], [7,5], [7,6], [7,7]
        ];
        
        walls.forEach(([r, c]) => {
            newGrid[toIndex(r, c)] = { type: 'wall' };
        });
        
        // Artworks hanging along the hallways
        newGrid[toIndex(2, 3)] = { type: 'art', artIds: {} };
        newGrid[toIndex(4, 4)] = { type: 'art', artIds: {} };
        newGrid[toIndex(6, 3)] = { type: 'art', artIds: {} };
        newGrid[toIndex(0, 4)] = { type: 'art', artIds: {} };
        newGrid[toIndex(7, 4)] = { type: 'art', artIds: {} };
        newGrid[toIndex(3, 0)] = { type: 'art', artIds: {} };
        newGrid[toIndex(5, 7)] = { type: 'art', artIds: {} };
        
        // Spawn at the beginning of corridor
        newGrid[toIndex(1, 0)] = { type: 'spawn', spawnDir: 'E' };
    }
    return newGrid;
}

function distributeArtworksToEmptySlots() {
    if (artworks.length === 0) return;
    
    let artIdx = 0;
    for (let i = 0; i < grid.length; i++) {
        if (grid[i].type === 'art' && (!grid[i].artIds || Object.keys(grid[i].artIds).length === 0)) {
            // Initialize if missing
            if (!grid[i].artIds) grid[i].artIds = {};
            
            // Auto-assign to North face only to prevent duplicates on corners by default
            grid[i].artIds['N'] = artworks[artIdx % artworks.length].id;
            
            // If it's a pillar in "hall", fill other faces too but with different art
            if (artworks.length > 4) {
                grid[i].artIds['S'] = artworks[(artIdx + 1) % artworks.length].id;
                artIdx += 2;
            } else artIdx++;
        }
    }
}

// ========================================================
// 4. ARTWORK SELECTION DRAWER (Right Panel)
// ========================================================
function openArtPanel(index) {
    artConfigPlaceholder.classList.add('hidden');
    artConfigActive.classList.remove('hidden');
    
    // Set cell details
    const row = Math.floor(index / gridWidth);
    const col = index % gridWidth;
    selectedCellCoords.textContent = `(Row: ${row + 1}, Col: ${col + 1})`;
    
    renderArtworkPicker();
}

function closeArtPanel() {
    artConfigPlaceholder.classList.remove('hidden');
    artConfigActive.classList.add('hidden');
}

function renderArtworkPicker() {
    artworkPickerList.innerHTML = '';
    
    // 1. Add Face Selector UI at the top
    const faceSelector = document.createElement('div');
    faceSelector.className = 'face-selector-row';
    faceSelector.style = "display: flex; gap: 5px; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;";
    
    ['N', 'S', 'E', 'W'].forEach(face => {
        const btn = document.createElement('button');
        btn.textContent = face;
        btn.style = "flex: 1; padding: 5px; cursor: pointer; border: 1px solid #444; background: #222; color: #fff; font-weight: bold; position: relative;";
        if (activeFace === face) {
            btn.style.borderColor = 'var(--dev-accent)';
            btn.style.background = 'rgba(0, 255, 157, 0.1)';
        }

        // Show indicator if this face already has an art assigned
        if (selectedCellIndex !== null && grid[selectedCellIndex] && grid[selectedCellIndex].artIds && grid[selectedCellIndex].artIds[face]) {
            btn.classList.add('assigned');
        }

        btn.onclick = () => {
            activeFace = face;
            renderArtworkPicker();
        };
        faceSelector.appendChild(btn);
    });
    artworkPickerList.appendChild(faceSelector);

    // 2. Filter and Render Artworks
    const filteredArtworks = artworks.filter(art => art.type === activeTab);
    
    if (filteredArtworks.length === 0) {
        artworkPickerList.innerHTML = '<p class="art-config-placeholder" style="font-size:0.8rem; height:auto;">No content available in this category.</p>';
        return;
    }
    
    // Get active painting ID for the SELECTED FACE
    const currentArtId = selectedCellIndex !== null ? (grid[selectedCellIndex].artIds[activeFace] || null) : null;
    
    filteredArtworks.forEach(art => {
        const item = document.createElement('div');
        item.className = 'art-picker-item';
        if (currentArtId === art.id) {
            item.classList.add('active');
            if (art.type === 'developer') item.classList.add('dev-art-type');
        }
        
        item.innerHTML = `
            <div class="art-picker-thumb">
                <img src="${art.image}" alt="${art.title}">
            </div>
            <div class="art-picker-info">
                <h4>${art.title}</h4>
                <span>${art.subtitle}</span>
            </div>
        `;
        
        item.addEventListener('click', () => {
            if (selectedCellIndex !== null) {
                // Assign art to cell
                if (!grid[selectedCellIndex].artIds) grid[selectedCellIndex].artIds = {};
                
                // Toggle: if clicking already selected, clear it
                if (grid[selectedCellIndex].artIds[activeFace] === art.id) {
                    grid[selectedCellIndex].artIds[activeFace] = null;
                } else {
                    grid[selectedCellIndex].artIds[activeFace] = art.id;
                }
                
                // Update cell visuals
                const cellEl = gridEl.querySelector(`[data-index="${selectedCellIndex}"]`);
                applyCellVisuals(cellEl, grid[selectedCellIndex]);
                
                // Update stats & highlights
                saveGridState();
                updateStats();
                
                // Re-render picker list to move highlight
                renderArtworkPicker();
            }
        });
        
        artworkPickerList.appendChild(item);
    });
}

// ========================================================
// 5. AUXILIARY / STATS & UTILS
// ========================================================
function updateStats() {
    const artCount = grid.reduce((acc, cell) => {
        if (cell.type === 'art' && cell.artIds) {
            const uniqueAssigned = Object.values(cell.artIds).filter(v => v !== null).length;
            return acc + uniqueAssigned;
        }
        return acc;
    }, 0);

    const hasSpawn = grid.some(c => c.type === 'spawn');
    
    statArtCount.textContent = artCount;
    statSpawnSet.textContent = hasSpawn ? 'Yes' : 'No';
    statSpawnSet.style.color = hasSpawn ? 'var(--dev-accent)' : '#ff4a4a';

    // Update the grid size display in the footer
    if (statGridSize) {
        statGridSize.textContent = `${gridWidth} x ${gridHeight}`;
    }
    
    // Launch button validation: Spawn point MUST be set
    if (hasSpawn) {
        btnLaunch.disabled = false;
        btnLaunch.classList.remove('disabled');
    } else {
        btnLaunch.disabled = true;
        btnLaunch.classList.add('disabled');
    }
}

// ========================================================
// 6. EVENT BINDINGS
// ========================================================
function bindEvents() {
    // --- Zoom & Pan Events ---
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            isSpaceDown = true;
            if (gridViewContainer) gridViewContainer.style.cursor = 'grab';
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isSpaceDown = false;
            isPanning = false;
            if (gridViewContainer) gridViewContainer.style.cursor = 'crosshair';
        }
        if (e.ctrlKey && e.code === 'KeyZ') {
            undo();
        }
        if (e.ctrlKey && e.code === 'KeyY') {
            redo();
        }
    });

    if (gridViewContainer) {
        gridViewContainer.addEventListener('mousedown', (e) => {
            if (isSpaceDown || e.button === 1) { // Space or Middle Click
                isPanning = true;
                lastMousePos = { x: e.clientX, y: e.clientY };
                gridViewContainer.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isPanning) {
                const dx = e.clientX - lastMousePos.x;
                const dy = e.clientY - lastMousePos.y;
                gridPan.x += dx;
                gridPan.y += dy;
                lastMousePos = { x: e.clientX, y: e.clientY };
                updateGridTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            isPanning = false;
            if (isSpaceDown && gridViewContainer) gridViewContainer.style.cursor = 'grab';
        });

        gridViewContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            gridZoom = Math.min(Math.max(0.5, gridZoom * delta), 3.0);
            updateGridTransform();
        }, { passive: false });
    }

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            gridZoom = Math.min(3.0, gridZoom * 1.2);
            updateGridTransform();
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            gridZoom = Math.max(0.5, gridZoom / 1.2);
            updateGridTransform();
        });
    }

    if (btnZoomReset) {
        btnZoomReset.addEventListener('click', () => {
            gridZoom = 1.0;
            gridPan = { x: 0, y: 0 };
            updateGridTransform();
        });
    }

    // Tool buttons toggle
    Object.keys(toolBtns).forEach(tool => {
        toolBtns[tool].addEventListener('click', () => {
            // Deactivate others
            Object.keys(toolBtns).forEach(t => toolBtns[t].classList.remove('active'));
            // Activate current
            toolBtns[tool].classList.add('active');
            activeTool = tool;
        });
    });
    
    // Preset buttons loading
    Object.keys(presetBtns).forEach(name => {
        presetBtns[name].addEventListener('click', () => {
            if (confirm(`Load the "${presetBtns[name].querySelector('strong').textContent}" layout? This will clear your current grid config.`)) {
                selectedCellIndex = null;
                closeArtPanel();
                loadPreset(name);
                saveGridState();
                initializeGrid();
                updateStats();
            }
        });
    });
    
    if (btnUndo) {
        btnUndo.addEventListener('click', undo);
    }
    
    if (btnRedo) {
        btnRedo.addEventListener('click', redo);
    }

    // Reset to data.json Layout
    if (btnResetFile) {
        btnResetFile.addEventListener('click', () => {
            if (confirm("Reset current grid to match the layout defined in data.json? This will clear your unsaved local changes.")) {
                localStorage.removeItem('gallery_3d_grid');
                loadGridState();
                initializeGrid();
                updateStats();
            }
        });
    }

    if (btnMoveSelection) {
        btnMoveSelection.addEventListener('click', () => {
            if (selectedIndices.length === 0) {
                alert("Please select one or more cells using the Select tool first.");
                return;
            }
            isMoveMode = !isMoveMode;
            if (isMoveMode) {
                btnMoveSelection.classList.add('active');
                alert("Move Mode Active: Click a cell on the grid to place the selection.");
            } else {
                btnMoveSelection.classList.remove('active');
            }
        });
    }

    if (btnClearSelection) {
        btnClearSelection.addEventListener('click', () => {
            selectedIndices = [];
            initializeGrid();
            updateStats();
        });
    }

    if (btnResizeGrid) {
        btnResizeGrid.addEventListener('click', () => {
            const newW = parseInt(inputGridWidth.value);
            const newH = parseInt(inputGridHeight.value);
            
            if (isNaN(newW) || isNaN(newH) || newW < 4 || newH < 4 || newW > 25 || newH > 25) {
                alert("Please enter valid dimensions (4-25).");
                return;
            }
            
            if (confirm(`Resize grid to ${newW}x${newH}? Some existing cell placements may be shifted.`)) {
                resizeGrid(newW, newH);
            }
        });
    }

    if (btnRotateLayout) {
        btnRotateLayout.addEventListener('click', () => {
            if (confirm("Rotate the entire layout 90 degrees clockwise?")) {
                rotateLayout();
            }
        });
    }

    btnClear.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear the entire grid?")) {
            selectedCellIndex = null;
            closeArtPanel();
            
            // Set all to floor
            grid = Array(gridWidth * gridHeight).fill(null).map(() => ({ type: 'floor' }));
            
            saveGridState();
            initializeGrid();
            updateStats();
        }
    });
    
    // Export Layout to Console and Download as File
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const exportObj = {
                width: gridWidth,
                height: gridHeight,
                cells: grid
            };
            const layoutData = JSON.stringify(exportObj, null, 2);
            const blob = new Blob([layoutData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gallery-layout.json';
            a.click();
            URL.revokeObjectURL(url);
            alert("Layout exported! Use the downloaded file to update your data.json.");
        });
    }

    // Art type tabs toggle
    tabCreative.addEventListener('click', () => {
        tabCreative.classList.add('active');
        tabDeveloper.classList.remove('active');
        activeTab = 'creative';
        renderArtworkPicker();
    });
    
    tabDeveloper.addEventListener('click', () => {
        tabDeveloper.classList.add('active');
        tabCreative.classList.remove('active');
        activeTab = 'developer';
        renderArtworkPicker();
    });
    
    // LAUNCH 3D GALLERY!
    btnLaunch.addEventListener('click', () => {
        const hasSpawn = grid.some(c => c.type === 'spawn');
        if (!hasSpawn) {
            alert('Please place a spawn point indicator on the map before launching!');
            return;
        }
        
        // Transition screens
        document.getElementById('editor-screen').classList.remove('active');
        document.getElementById('gallery-screen').classList.add('active');
        
        // Launch 3D loop
        start3DGallery(grid, artworks, gridWidth, gridHeight);
    });
    
    // GO BACK TO EDITOR MODE
    btnEdit.addEventListener('click', () => {
        // Stop 3D loops and release canvas
        stop3DGallery();
        
        // Transition screens
        document.getElementById('gallery-screen').classList.remove('active');
        document.getElementById('editor-screen').classList.add('active');
        
        // Re-render editor in case things changed
        initializeGrid();
        updateStats();
    });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadArtworksData();
});
