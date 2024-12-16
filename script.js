// Part 1: Initialization
let currentItems = [];
let galleryView;
let searchInput;
let menuToggle;
let dropdownMenu;
let searchContainer;
document.addEventListener('DOMContentLoaded', (event) => {
    galleryView = document.getElementById('gallery-view');
    searchIcon = document.querySelector('.search-icon-button');
    searchInput = document.querySelector('.search-input');
    menuToggle = document.getElementById('menu-toggle');
    dropdownMenu = document.getElementById('dropdown-menu');
    searchContainer = document.querySelector('.search-toggle-container');

    // Load gallery items
    loadGalleryItemsFromJSON();
    toggleGalleryView('large');

    // Setup event listeners
    setupEventListeners();
});

function loadGalleryItemsFromJSON() {
    fetch('gallery-items.json')
        .then(response => response.json())
        .then(data => {
            currentItems = data;
            loadGalleryItems(currentItems);
        })
        .catch(error => {
            console.error('Error fetching gallery items:', error);
        });
}
    // Part 2: Event Listeners Setup
    function setupEventListeners() {
        document.addEventListener('click', (event) => {
            if (!menuToggle.contains(event.target)) {
                dropdownMenu.classList.remove('show');
            }
            if (!searchContainer.contains(event.target) && searchInput.style.display === 'block') {
                searchInput.style.display = 'none';
            }
        });
    
        menuToggle.addEventListener('click', () => dropdownMenu.classList.toggle('show'));
        searchIcon.addEventListener('click', () => toggleSearchDisplay(searchInput));
        document.querySelectorAll('.sort-option, .view-option').forEach(option => {
            option.addEventListener('click', sortAndViewHandler);
        });
    
        // Correctly placed within the setupEventListeners function
        searchInput.addEventListener('input', debounce(function() {
            searchHandler();
        }, 300));
    }
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function toggleSearchDisplay(searchInput) {
    const isDisplayed = searchInput.style.display !== 'none';
    searchInput.style.display = isDisplayed ? 'none' : 'block';
    if (!isDisplayed) {
        searchInput.focus();
    }
}

function searchHandler() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    searchGalleryItems(searchTerm, currentItems);
}

function sortAndViewHandler(event) {
    const target = event.target;
    if (target.classList.contains('sort-option')) {
        handleSortOptionClick(target);
    } else if (target.classList.contains('view-option')) {
        handleViewOptionClick(target);
    }
}



function loadGalleryItems(items, forceSmallView = false) {
    galleryView.innerHTML = '';
    const galleryContainer = document.createElement('div');
    galleryContainer.className = 'gallery-container';
    galleryView.appendChild(galleryContainer);

    items.forEach(item => {
        galleryContainer.appendChild(createGalleryItem(item, forceSmallView || galleryView.classList.contains('small')));
    });
}

function createGalleryItem(item, isSmallView) {
    const galleryItem = document.createElement('div');
    galleryItem.className = 'gallery-item';
    galleryItem.dataset.id = item.id;
    galleryItem.innerHTML = `
    <img src="${item.media[0].url}" alt="${item.title}" class="gallery-image">
    <div class="text-content">
      <div class="title-year">
        <h3 class="item-title">${item.title}</h3>
        <span class="item-year">${item.year}</span>
      </div>
      <p class="item-medium">${item.medium}</p>
      <p class="item-description">${item.description}</p>
    </div>
  `;

    galleryItem.addEventListener('click', () => loadGalleryItemDetails(item.id));
    return galleryItem;
}



// Helper debounce function to limit how often a function is called
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

    function loadGalleryItemDetails(id) {
        const item = currentItems.find(item => item.id.toString() === id);
        galleryView.innerHTML = `<div class="gallery-item-detail"></div>`; // Prepare the detail view container
        const detailView = galleryView.querySelector('.gallery-item-detail');
// Part 2: Detail view and interaction
item.media.forEach(media => {
    const mediaElement = media.type === 'video' ?
        `<video controls src="${media.url}" class="gallery-detail-media"></video>` :
        `<img src="${media.url}" alt="${item.title}" class="gallery-detail-image">`;
    detailView.innerHTML += mediaElement;
});

detailView.innerHTML += `
    <h3>${item.title}</h3>
    <p>${item.year}, ${item.medium}</p>
    <p>${item.description}</p>
`;
attachArrowClickEvents(id, detailView); // Attach events for navigating items
}

function attachArrowClickEvents(currentId, detailView) {
    // Clear previous navigation arrows if any
    const existingArrows = detailView.querySelectorAll('.nav-arrow');
    existingArrows.forEach(arrow => arrow.remove());

    // Create left arrow for navigation
    const leftArrow = document.createElement('button');
    leftArrow.innerHTML = '←'; // Consider using an icon here
    leftArrow.className = 'nav-arrow left-arrow';
    detailView.appendChild(leftArrow);

    // Create right arrow for navigation
    const rightArrow = document.createElement('button');
    rightArrow.innerHTML = '→'; // Consider using an icon here
    rightArrow.className = 'nav-arrow right-arrow';
    detailView.appendChild(rightArrow);

    // Attach click event to the left arrow
    leftArrow.addEventListener('click', function() {
        navigateGallery('prev', currentId);
    });

    // Attach click event to the right arrow
    rightArrow.addEventListener('click', function() {
        navigateGallery('next', currentId);
    });
}

function navigateGallery(direction, currentId) {
    let index = currentItems.findIndex(item => item.id.toString() === currentId);
    if (direction === 'prev') {
        index = index - 1 < 0 ? currentItems.length - 1 : index - 1;
    } else {
        index = index + 1 >= currentItems.length ? 0 : index + 1;
    }
    loadGalleryItemDetails(currentItems[index].id.toString());
}


    // Sorts gallery items by year
    function sortByYear(year) {
        const sortedItems = currentItems.filter(item => item.year === year);
        loadGalleryItems(sortedItems);
    }

    // Sorts gallery items by medium
    function sortByMedium(medium) {
        const sortedItems = currentItems.filter(item => item.medium === medium);
        loadGalleryItems(sortedItems);
    }

    // Searches gallery items by title
    function searchGalleryItems(searchTerm) {
        const searchResults = currentItems.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));
        loadGalleryItems(searchResults);
    }
    function searchGalleryItems(searchTerm, items) {
        // Filter items based on the search term and call loadGalleryItems with the filtered list
        const filteredItems = items.filter(item => item.title.toLowerCase().includes(searchTerm));
        loadGalleryItems(filteredItems);
    }

   // Event listeners for sorting and view options
document.querySelectorAll('.sort-option, .view-option').forEach(option => {
    option.addEventListener('click', event => {
        if (event.target.closest('.sort-option')) {
            const value = option.textContent;
            if (value.match(/^\d{4}$/)) {
                sortByYear(parseInt(value));
            } else {
                sortByMedium(value);
            }
        } else if (event.target.closest('.view-option')) {
            const viewSize = option.textContent.trim().toLowerCase();
            galleryView.classList.remove('large', 'small');
            galleryView.classList.add(viewSize);
            loadGalleryItems(currentItems, viewSize === 'small');
        }
    });
});


function handleSortOptionClick(sortOption) {
    const value = sortOption.textContent;
    if (value.match(/^\d{4}$/)) {
        sortByYear(parseInt(value));
    } else {
        sortByMedium(value);
    }
}
function handleViewOptionClick(viewOption) {
    const viewSize = viewOption.textContent.trim().toLowerCase();
    toggleGalleryView(viewSize);
}
function toggleGalleryView(viewSize = 'large') {
    galleryView.className = 'gallery-view'; // Reset classes
    galleryView.classList.add(viewSize); // Apply the selected view class
    loadGalleryItems(currentItems); // Reload gallery items without forcing small view
}
    // Attach event listeners to view options in the dropdown menu
    document.querySelectorAll('.view-option').forEach(option => {
        option.addEventListener('click', event => {
            const viewSize = event.target.textContent.trim().toLowerCase();
            galleryView.className = 'gallery-view ' + viewSize;
            loadGalleryItems(currentItems, viewSize === 'small');
        });
    });

 // Toggle dropdown menu display on menu toggle button click
 menuToggle.addEventListener('click', function() {
    // Check if the dropdown menu is currently displayed
    const isDisplayed = dropdownMenu.classList.contains('show');
    if (isDisplayed) {
        dropdownMenu.classList.remove('show'); // Hide the dropdown menu
    } else {
        dropdownMenu.classList.add('show'); // Show the dropdown menu
    }
});
 // Ensure dropdown menu is closed when clicking anywhere outside of it
 window.addEventListener('click', function(event) {
    if (!event.target.matches('.menu-toggle') && !event.target.matches('.search-icon-button')) { // Modified to ignore search icon clicks
        var dropdown = document.getElementById('dropdown-menu');
        if (dropdown.classList.contains('show')) {
            dropdown.classList.remove('show'); // Modified to use classList for consistency
        }
        // New: Close search input if clicking outside of the search container
        if (!searchContainer.contains(event.target)) {
            searchInput.style.display = 'none';
        }
    }
});

