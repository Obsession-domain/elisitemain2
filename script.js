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
    fetch('gallery-items.json')
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

    const images      = item.media.filter(m => m.type === 'image');
    const firstImage  = images[0]?.url || '';
    const secondImage = images[1]?.url || '';

    galleryItem.innerHTML = `
        <div class="image-container">
            ${firstImage  ? `<img src="${firstImage}"  alt="${item.title}" class="gallery-image default-image">` : ''}
            ${secondImage ? `<img src="${secondImage}" alt="${item.title}" class="gallery-image hover-image">` : ''}
        </div>
        <div class="text-content">
            <div class="title-year">
                <h3 class="item-title">${item.title}</h3>
                <span class="item-year">${item.year}</span>
            </div>
            <p class="item-medium">${item.medium}</p>
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

    // Jump instantly to the clicked item
    requestAnimationFrame(() => {
        const target = document.getElementById(`detail-card-${startId}`);
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
}

// Builds the same card as the old detail view, reusing all the same classes
function createDetailCard(item) {
    const wrapper = document.createElement('div');
    wrapper.id        = `detail-card-${item.id}`;
    wrapper.className = 'detail-card-wrapper';

    // Card uses exact same markup and classes as before
    wrapper.innerHTML = `
        <div class="gallery-item-detail">
            <div class="media-column">
                <div class="main-media-container"></div>
                <div class="thumbnails-container"></div>
            </div>
            <div class="details-column">
                <div class="media-details"></div>
                <div id="paypal-card-${item.id}" class="paypal-container"></div>
            </div>
        </div>
    `;

    const detailEl        = wrapper.querySelector('.gallery-item-detail');
    const mainMedia       = wrapper.querySelector('.main-media-container');
    const thumbsContainer = wrapper.querySelector('.thumbnails-container');
    const mediaDetails    = wrapper.querySelector('.media-details');

    let currentMediaIndex = 0;

    function showMedia(index) {
        mainMedia.innerHTML    = '';
        mediaDetails.innerHTML = '';

        const media = item.media[index];
        mainMedia.innerHTML = media.type === 'video'
            ? `<video controls src="${media.url}" class="gallery-detail-media"></video>`
            : `<img src="${media.url}" alt="${item.title}" class="gallery-detail-image">`;

        // Orientation class (desktop only)
        if (media.type === 'image') {
            const img = mainMedia.querySelector('img');
            const setOrientation = () => {
                if (window.innerWidth >= 769) {
                    detailEl.classList.remove('landscape-mode', 'portrait-mode');
                    detailEl.classList.add(img.naturalWidth > img.naturalHeight ? 'landscape-mode' : 'portrait-mode');
                }
            };
            img.complete ? setOrientation() : (img.onload = setOrientation);
        }

        mediaDetails.innerHTML = `
            <h3>${item.title}</h3>
            <p>${item.year}, ${item.medium}</p>
            <p>${item.description}</p>
        `;

        updateThumbnails(index);
    }

    function createThumbnails() {
        thumbsContainer.innerHTML = '';
        item.media.forEach((media, index) => {
            const thumb = document.createElement('img');
            thumb.src   = media.url;
            thumb.alt   = `Thumbnail ${index + 1}`;
            thumb.classList.add('thumbnail');
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