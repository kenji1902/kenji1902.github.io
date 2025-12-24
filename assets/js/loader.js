
// assets/js/loader.js

// assets/js/loader.js
import { Effect } from './hero.js';

async function loadData() {
    try {
        const response = await fetch('./data.json');
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();

        renderDeveloper(data.developer);
        renderCreative(data.creative);

        // Update Height for Unified Scroll
        setTimeout(() => {
            if (window.updateHeight) window.updateHeight();
        }, 500);

        // Initialize Hero Interactive Effects
        if (data.heroConfig) {
            // Configs are now separate in data.json
            initHero(data.heroConfig);
        }

        // Remove loading overlay
        setTimeout(() => {
            document.getElementById('loading-overlay').classList.add('fade-out');
        }, 1000); // Small delay to let canvas init
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function initHero(config) {
    const canvasDev = document.getElementById('canvas-dev');
    const canvasCreative = document.getElementById('canvas-creative');

    // Set Dimensions
    const setSize = (c) => {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
    }
    setSize(canvasDev);
    setSize(canvasCreative);

    // Create Effects
    // data.heroConfig.developer and .creative are now fully populated
    const devEffect = new Effect(canvasDev, 'developer', config.developer, config);
    const creativeEffect = new Effect(canvasCreative, 'creative', config.creative, config);

    // Debounce resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            setSize(canvasDev);
            setSize(canvasCreative);
            devEffect.resize(window.innerWidth, window.innerHeight);
            creativeEffect.resize(window.innerWidth, window.innerHeight);
        }, 200);
    });
}

function renderDeveloper(data) {
    const container = document.getElementById('developer-content');

    // Skills Section
    const skillsSection = document.createElement('div');
    skillsSection.className = 'card';
    skillsSection.innerHTML = `
        <h3>SKILLS</h3>
        <div class="skills-wrapper" style="margin-top: 1rem;">
            ${data.skills.map(skill => `<span class="skill-tag dev-skill">${skill}</span>`).join('')}
        </div>
    `;
    container.appendChild(skillsSection);

    // Markdown Section (Loading from about.md)
    const markdownSection = document.createElement('div');
    markdownSection.className = 'card markdown-section';
    markdownSection.innerHTML = '<p style="color: #666; font-style: italic;">Loading additional info...</p>';
    container.appendChild(markdownSection);

    fetch('./about.md')
        .then(response => {
            if (!response.ok) throw new Error('Markdown not found');
            return response.text();
        })
        .then(mdText => {
            let htmlContent = '';
            if (window.marked) {
                htmlContent = marked.parse(mdText);
            } else {
                htmlContent = `<pre>${mdText}</pre>`;
            }

            markdownSection.innerHTML = `
                <div class="markdown-wrapper collapsed">
                    <div class="markdown-content">${htmlContent}</div>
                </div>
                <button class="read-more-btn">Read More</button>
            `;

            const wrapper = markdownSection.querySelector('.markdown-wrapper');
            const btn = markdownSection.querySelector('.read-more-btn');

            btn.addEventListener('click', () => {
                const isCollapsed = wrapper.classList.contains('collapsed');
                if (isCollapsed) {
                    wrapper.classList.remove('collapsed');
                    wrapper.classList.add('expanded');
                    btn.textContent = 'Read Less';
                } else {
                    wrapper.classList.add('collapsed');
                    wrapper.classList.remove('expanded');
                    btn.textContent = 'Read More';

                    // Optional: scroll back to the section top when collapsing
                    markdownSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Trigger height update for scroll sync
                if (window.updateHeight) window.updateHeight();
            });
        })
        .catch(err => {
            console.warn('Markdown load failed:', err);
            markdownSection.remove(); // Hide if not available
        });

    // Projects Section
    data.projects.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'card project-card';

        let imagesHtml = '';
        if (project.images && project.images.length > 0) {
            imagesHtml = `<div class="project-images baguetteBox-gallery">
                ${project.images.map(img => `
                    <a href="${img}" data-caption="${project.title}">
                        <img src="${img}" alt="${project.title}" loading="lazy">
                    </a>
                `).join('')}
            </div>`;
        }

        projectCard.innerHTML = `
            <div>
                <h4 style="color: var(--dev-secondary);">${project.subtitle}</h4>
                <h2 style="color: var(--dev-accent); margin: 0.5rem 0;">${project.title}</h2>
                <hr style="border-color: rgba(255,255,255,0.1); margin: 1rem 0;">
                <p>${project.description}</p>
            </div>
            ${imagesHtml}
        `;
        container.appendChild(projectCard);
    });

    // Initialize lightbox for new content if script is ready
    if (window.baguetteBox) baguetteBox.run('.baguetteBox-gallery');
}

function renderCreative(data) {
    const container = document.getElementById('creative-content');

    // Bio / Passion
    const bioCard = document.createElement('div');
    bioCard.style.marginBottom = '2rem';
    bioCard.innerHTML = `
        <h3 class="brush-text" style="font-size: 2rem; color: var(--creative-secondary);">Passion</h3>
        <p style="font-size: 1.1rem; margin-top: 0.5rem;">${data.passion}</p>
        <div style="margin-top: 1rem;">
            ${data.softwares.map(sw => `<span class="skill-tag" style="border-color: var(--creative-accent); color: var(--creative-accent);">${sw}</span>`).join('')}
        </div>
    `;
    container.appendChild(bioCard);

    // ART HIGHLIGHT (First Image)
    if (data.gallery && data.gallery.length > 0) {
        const highlightImg = data.gallery[0];
        const highlightDesc = data.highlightDescription || "Featured Artwork";
        const highlightLink = data.highlightLink || "#";
        const highlightTitle = data.highlightTitle || "Featured Artwork";
        const restImages = data.gallery.slice(1);

        const highlightSection = document.createElement('div');
        highlightSection.className = 'art-highlight';

        // Split Layout HTML
        highlightSection.innerHTML = `
            <div class="highlight-card">
                 <div class="highlight-img-col">
                     <a class="lightbox" href="${highlightImg}" data-caption="${highlightDesc}">
                        <img src="${highlightImg}" alt="Highlight Art" loading="lazy">
                     </a>
                 </div>
                 <div class="highlight-text-col">
                     <h3 style="color: var(--creative-accent); margin-bottom: 0.5rem;">${highlightTitle}</h3>
                     <p style="margin: 1rem 0; font-style: italic; color: #ccc; line-height: 1.6;">${highlightDesc}</p>
                     
                     ${data.highlightLink ? `
                     <a href="${highlightLink}" target="_blank" class="view-link">
                        View on Instagram <span>&rarr;</span>
                     </a>` : ''}
                 </div>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 2rem 0;">
        `;
        container.appendChild(highlightSection);

        // Gallery Grid (Remaining Images)
        const galleryGrid = document.createElement('div');
        galleryGrid.className = 'gallery-grid tz-gallery'; // tz-gallery for baguetteBox

        restImages.forEach(imgSrc => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <a class="lightbox" href="${imgSrc}">
                    <img src="${imgSrc}" alt="Creative Work" loading="lazy">
                </a>
            `;
            galleryGrid.appendChild(item);
        });
        container.appendChild(galleryGrid);
    } else {
        // Fallback if no images
        const galleryGrid = document.createElement('div');
        galleryGrid.className = 'gallery-grid tz-gallery';
        container.appendChild(galleryGrid);
    }

    // Refresh lightbox
    if (window.baguetteBox) baguetteBox.run('.tz-gallery, .art-highlight');
}

// Initialize
document.addEventListener('DOMContentLoaded', loadData);
