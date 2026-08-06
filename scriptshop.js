// ─── Globals ───────────────────────────────────────────────────────────────
let currentItems = [];
let galleryView;
let menuToggle;
let dropdownMenu;

// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    galleryView  = document.getElementById('gallery-view');
    menuToggle   = document.getElementById('menu-toggle');
    dropdownMenu = document.getElementById('dropdown-menu');

    const dropdownSearch = document.getElementById('dropdown-search');

    loadGalleryItemsFromJSON();
    toggleGalleryView('large');
    setupEventListeners(dropdownSearch);
});

// ─── Data ───────────────────────────────────────────────────────────────────
function loadGalleryItemsFromJSON() {
    fetch('shop-items.json')
        .then(r => r.json())
        .then(data => {
            currentItems = data;
            loadGalleryItems(currentItems);
        })
        .catch(err => console.error('Error fetching gallery items:', err));
}

// ─── Event Listeners ────────────────────────────────────────────────────────
function setupEventListeners(dropdownSearch) {
    document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && e.target !== menuToggle) {
            dropdownMenu.classList.remove('show');
        }
    });

    menuToggle.addEventListener('click', () => dropdownMenu.classList.toggle('show'));

    if (dropdownSearch) {
        dropdownSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchGalleryItems(this.value.trim().toLowerCase(), currentItems);
            }
        });
        const searchIcon = document.getElementById('search-icon');
        if (searchIcon) {
            searchIcon.addEventListener('click', () => {
                searchGalleryItems(dropdownSearch.value.trim().toLowerCase(), currentItems);
            });
        }
        dropdownSearch.addEventListener('click', e => e.stopPropagation());
    }

    document.querySelectorAll('.sort-option, .view-option').forEach(option => {
        option.addEventListener('click', sortAndViewHandler);
    });

    document.querySelectorAll('.view-option').forEach(option => {
        option.addEventListener('click', e => {
            const viewSize = e.target.textContent.trim().toLowerCase();
            galleryView.className = 'gallery-view ' + viewSize;
            loadGalleryItems(currentItems, viewSize === 'small');
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeScrollView();
    });

    window.addEventListener('scroll', () => {
        const navbar       = document.querySelector('.navbar');
        const isScrollView = galleryView.classList.contains('scroll-view-active');
        if (isScrollView) {
            navbar.classList.add('scrolled');
            return;
        }
        navbar.classList.toggle('scrolled', (window.scrollY || window.pageYOffset) > 50);
    });
}

// ─── Gallery Grid ─────────────────────────────────────────────────────────────
function loadGalleryItems(items, forceSmallView = false) {
    galleryView.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'gallery-container';
    items.forEach(item => {
        container.appendChild(createGalleryItem(item, forceSmallView || galleryView.classList.contains('small')));
    });
    galleryView.appendChild(container);
}

function createGalleryItem(item) {
    const galleryItem      = document.createElement('div');
    galleryItem.className  = 'gallery-item';
    galleryItem.dataset.id = item.id;

    const videos = item.media.filter(m => m.type === 'video');
    const images = item.media.filter(m => m.type === 'image');
    const isVideoOnly = typeof item.videoOnly === 'boolean'
        ? item.videoOnly
        : (videos.length === 1 && images.length === 1);

    // Video-only entries never get a hover-swap image, so don't let the
    // default image fade out on hover (nothing to fade in behind it).
    if (isVideoOnly) galleryItem.classList.add('video-only');

    const firstImage  = images[0]?.url || '';
    const secondImage = isVideoOnly ? '' : (images[1]?.url || '');

    galleryItem.innerHTML = `
        <div class="image-container">
            ${firstImage  ? `<img src="${firstImage}"  alt="${item.title}" class="gallery-image default-image">` : ''}
            ${secondImage ? `<img src="${secondImage}" alt="${item.title}" class="gallery-image hover-image">` : ''}
            ${isVideoOnly ? `<div class="play-button-overlay"><div class="play-button-icon"></div></div>` : ''}
        </div>
        <div class="text-content">
            <div class="title-year">
                <h3 class="item-title">${item.title}</h3>
                <h3 class="item-year">${item.year}</h3>
                <h3 class="item-medium">${item.medium}</h3>
            </div>
                        <p class="item-description">${item.description}</p>

            
        </div>
    `;

    galleryItem.addEventListener('click', () => openScrollView(item.id.toString()));
    return galleryItem;
}

// ─── Infinite Scroll View ────────────────────────────────────────────────────
function openScrollView(startId) {
    galleryView.innerHTML = '';
    galleryView.classList.add('scroll-view-active');

    // Fixed close button
    const closeBtn = document.createElement('button');
    closeBtn.id        = 'scroll-view-close';
    closeBtn.innerHTML = '<img src="exitbutton.png" alt="Close" class="close-icon-visible">';
    closeBtn.addEventListener('click', closeScrollView);
    document.body.appendChild(closeBtn);

    // Wrapper that stacks all cards vertically
    const stack = document.createElement('div');
    stack.className = 'scroll-view-stack';

    currentItems.forEach(item => {
        stack.appendChild(createDetailCard(item));
    });

    galleryView.appendChild(stack);
    document.querySelector('.navbar').classList.add('scrolled');

    // Jump instantly to the clicked item with 100px headroom
    requestAnimationFrame(() => {
        const target = document.getElementById(`detail-card-${startId}`);
        if (target) {
            const top = target.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top, behavior: 'instant' });
        }
    });
}

// Builds the same card as the old detail view, reusing all the same classes
function createDetailCard(item) {
    const wrapper = document.createElement('div');
    wrapper.id        = `detail-card-${item.id}`;
    wrapper.className = 'detail-card-wrapper';

    // Card uses exact same markup and classes as before
    const videoCountForClass = item.media.filter(m => m.type === 'video').length;
    const imageCountForClass = item.media.filter(m => m.type === 'image').length;
    const isVideoOnlyForClass = typeof item.videoOnly === 'boolean'
        ? item.videoOnly
        : (videoCountForClass === 1 && imageCountForClass === 1);

    wrapper.innerHTML = `
        <div class="gallery-item-detail${isVideoOnlyForClass ? ' video-detail' : ''}">
           <div class="details-column">
                <div class="media-details"></div>
                <div id="paypal-card-${item.id}" class="paypal-container"></div>
            </div>
        <div class="media-column">
                <div class="main-media-container"></div>
                <div class="thumbnails-container"></div>
            </div>
            
        </div>
    `;

    const mainMedia       = wrapper.querySelector('.main-media-container');
    const thumbsContainer = wrapper.querySelector('.thumbnails-container');
    const mediaDetails    = wrapper.querySelector('.media-details');

    // ── Video-only detection ────────────────────────────────────────────
    // Auto-detect items that have exactly one video + one picture, and
    // treat them as "video only" in the detail view (no image, no thumb
    // strip since there's nothing to switch between).
    // Override per-item in gallery-items.json with "videoOnly": true/false.
    const videoCount = item.media.filter(m => m.type === 'video').length;
    const imageCount = item.media.filter(m => m.type === 'image').length;
    const isVideoOnly = typeof item.videoOnly === 'boolean'
        ? item.videoOnly
        : (videoCount === 1 && imageCount === 1);

    // The list of media this card will actually cycle through
    const mediaList = isVideoOnly
        ? item.media.filter(m => m.type === 'video')
        : item.media;

    let currentMediaIndex = 0;

    function showMedia(index) {
        mainMedia.innerHTML    = '';
        mediaDetails.innerHTML = '';

        const media = mediaList[index];
        if (media.type === 'video') {
    mainMedia.innerHTML = `<iframe 
        src="${media.url}" 
        class="gallery-detail-media" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
    </iframe>`;
} else {
    mainMedia.innerHTML = `<img src="${media.url}" alt="${item.title}" class="gallery-detail-image">`;
    setupImageZoom(mainMedia);
}

        mediaDetails.innerHTML = `
            <h3><span class="detail-title">${item.title}</span><span class="detail-meta"> &nbsp${item.year}, ${item.medium}</span></h3>
            <p>${item.description}</p>
        `;

        if (!isVideoOnly) updateThumbnails(index);
    }

    function createThumbnails() {
    thumbsContainer.innerHTML = '';

    // Video-only cards have nothing to switch between, so skip the strip.
    if (isVideoOnly) {
        thumbsContainer.style.display = 'none';
        return;
    }
    thumbsContainer.style.display = '';

    mediaList.forEach((media, index) => {
        const thumb = document.createElement(media.type === 'video' ? 'div' : 'img');
        if (media.type === 'video') {
            thumb.className = 'thumbnail video-thumb';
            thumb.textContent = '▶';
        } else {
            thumb.src = media.url;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.classList.add('thumbnail');
        }
        if (index === 0) thumb.classList.add('active');
        thumb.addEventListener('click', () => {
            currentMediaIndex = index;
            showMedia(index);
        });
        thumbsContainer.appendChild(thumb);
    });
}

    function updateThumbnails(activeIndex) {
        thumbsContainer.querySelectorAll('.thumbnail').forEach((t, i) => {
            t.classList.toggle('active', i === activeIndex);
        });
    }

    showMedia(0);
    createThumbnails();

    // PayPal
    if (item.paypalButtonId) {
        const paypalAnchor = wrapper.querySelector(`#paypal-card-${item.id}`);
        paypalAnchor.innerHTML = `
            <div class="paypal-detail-container">
                <paypal-add-to-cart-button data-id="${item.paypalButtonId}"></paypal-add-to-cart-button>
            </div>
        `;
        requestAnimationFrame(() => {
            try { cartPaypal.AddToCart({ id: item.paypalButtonId }); } catch(e) {}
        });
    }

    return wrapper;
}

// ─── Magnifying-Glass Zoom (desktop detail view only) ────────────────────────
const ZOOM_FACTOR = 2.0;
const ZOOM_LENS_SIZE = 220;

// Single shared lens, appended to <body> so it's never clipped by a card's
// overflow:hidden and always paints above every other element on the page.
let zoomLensEl = null;
function getZoomLens() {
    if (!zoomLensEl) {
        zoomLensEl = document.createElement('div');
        zoomLensEl.className = 'zoom-lens';
        zoomLensEl.style.width  = `${ZOOM_LENS_SIZE}px`;
        zoomLensEl.style.height = `${ZOOM_LENS_SIZE}px`;
        document.body.appendChild(zoomLensEl);
    }
    return zoomLensEl;
}

function setupImageZoom(container) {
    // Desktop/hover-capable devices only — on touch devices there's no
    // hover to trigger the lens, so skip entirely rather than leaving
    // dead listeners around.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const img = container.querySelector('.gallery-detail-image');
    if (!img) return;

    function init() {
        const lens = getZoomLens();

        function positionLens(e) {
            // Fixed positioning is relative to the viewport, so this maps
            // directly to the mouse coordinates — no container offset math.
            lens.style.left = `${e.clientX - ZOOM_LENS_SIZE / 2}px`;
            lens.style.top  = `${e.clientY - ZOOM_LENS_SIZE / 2}px`;

            const imgRect = img.getBoundingClientRect();
            const relX = e.clientX - imgRect.left;
            const relY = e.clientY - imgRect.top;
            const bgX  = relX * ZOOM_FACTOR - ZOOM_LENS_SIZE / 2;
            const bgY  = relY * ZOOM_FACTOR - ZOOM_LENS_SIZE / 2;
            lens.style.backgroundPosition = `-${bgX}px -${bgY}px`;
        }

        function showLens(e) {
            lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
            lens.style.backgroundSize  = `${img.clientWidth * ZOOM_FACTOR}px ${img.clientHeight * ZOOM_FACTOR}px`;
            positionLens(e);
            lens.classList.add('visible');
            container.classList.add('zoom-active');
        }

        // Rely on mousemove (not just mouseenter) to reveal the lens —
        // if the image renders right under a cursor that hasn't moved yet
        // (e.g. right where a click just landed), mouseenter never fires,
        // but the very next mousemove will.
        img.addEventListener('mousemove', (e) => {
            if (!lens.classList.contains('visible')) {
                showLens(e);
            } else {
                positionLens(e);
            }
        });

        img.addEventListener('mouseleave', () => {
            lens.classList.remove('visible');
            container.classList.remove('zoom-active');
        });
    }

    if (img.complete && img.naturalWidth > 0) {
        init();
    } else {
        img.addEventListener('load', init, { once: true });
    }
}

function closeScrollView() {
    document.getElementById('scroll-view-close')?.remove();
    galleryView.classList.remove('scroll-view-active');
    galleryView.innerHTML = '';
    loadGalleryItems(currentItems);
    document.querySelector('.navbar').classList.remove('scrolled');
    window.scrollTo({ top: 0, behavior: 'instant' });
}

// ─── Sort / Search / View ─────────────────────────────────────────────────────
function sortAndViewHandler(e) {
    const target = e.target;
    if (target.classList.contains('sort-option')) handleSortOptionClick(target);
    if (target.classList.contains('view-option'))  handleViewOptionClick(target);
}

function handleSortOptionClick(option) {
    const value = option.textContent;
    value.match(/^\d{4}$/) ? sortByYear(parseInt(value)) : sortByMedium(value);
}

function handleViewOptionClick(option) {
    toggleGalleryView(option.textContent.trim().toLowerCase());
}

function toggleGalleryView(viewSize = 'large') {
    galleryView.className = 'gallery-view';
    galleryView.classList.add(viewSize);
    loadGalleryItems(currentItems);
}

function sortByYear(year) {
    loadGalleryItems(currentItems.filter(i => i.year === year));
}

function sortByMedium(medium) {
    loadGalleryItems(currentItems.filter(i => i.medium === medium));
}

function searchGalleryItems(searchTerm, items) {
    loadGalleryItems(items.filter(i =>
        i.title.toLowerCase().includes(searchTerm) ||
        (i.description && i.description.toLowerCase().includes(searchTerm))
    ));
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}