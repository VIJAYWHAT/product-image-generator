/**
 * AI Industrial Product Catalog - Frontend Application Logic
 * Strict Requirements: Vanilla JavaScript, Fetch API, Safe DOM manipulation (No raw innerHTML for untrusted JSON).
 */

(function () {
  'use strict';

  // Configuration Constants
  const CONFIG = {
    DATA_URL: 'data/products.json',
    POLL_INTERVAL_MS: 5000,
    CURRENCY_SYMBOL: '$',
    MATCH_THRESHOLDS: {
      HIGH: 90,
      MID: 75
    }
  };

  // Application State
  const state = {
    catalogData: null,
    products: [],
    lastRawDataHash: '',
    isLoading: false,
    pollTimer: null,
    filters: {
      search: '',
      category: 'ALL',
      subcategory: 'ALL',
      status: 'ALL',
      sortBy: 'title_asc'
    },
    activeModalProduct: null
  };

  // DOM Elements Cache
  const DOM = {
    // Header KPIs
    kpiTotalProducts: document.getElementById('kpiTotalProducts'),
    kpiActiveProducts: document.getElementById('kpiActiveProducts'),
    kpiInactiveProducts: document.getElementById('kpiInactiveProducts'),
    kpiTotalCategories: document.getElementById('kpiTotalCategories'),
    kpiGeneratedImages: document.getElementById('kpiGeneratedImages'),
    lastUpdatedValue: document.getElementById('lastUpdatedValue'),
    syncPulseDot: document.getElementById('syncPulseDot'),
    syncStatusText: document.getElementById('syncStatusText'),
    footerCatalogName: document.getElementById('footerCatalogName'),

    // Controls
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    categoryFilter: document.getElementById('categoryFilter'),
    subcategoryFilter: document.getElementById('subcategoryFilter'),
    statusFilter: document.getElementById('statusFilter'),
    sortBySelect: document.getElementById('sortBySelect'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    refreshIcon: document.getElementById('refreshIcon'),

    // Feedback & Containers
    notificationBanner: document.getElementById('notificationBanner'),
    notificationMessage: document.getElementById('notificationMessage'),
    notificationCloseBtn: document.getElementById('notificationCloseBtn'),
    visibleCount: document.getElementById('visibleCount'),
    totalCount: document.getElementById('totalCount'),
    activeFilterChips: document.getElementById('activeFilterChips'),
    productGrid: document.getElementById('productGrid'),

    // Modal
    imageModal: document.getElementById('imageModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalProductTitle: document.getElementById('modalProductTitle'),
    modalItemNo: document.getElementById('modalItemNo'),
    modalImage: document.getElementById('modalImage'),
    modalCategory: document.getElementById('modalCategory'),
    modalImageMatchVal: document.getElementById('modalImageMatchVal'),
    modalImageMatchProgress: document.getElementById('modalImageMatchProgress'),
    modalImageStatus: document.getElementById('modalImageStatus'),
    modalPriceInfo: document.getElementById('modalPriceInfo'),
    modalVendor: document.getElementById('modalVendor')
  };

  // =========================================================================
  // Helper Utilities (Formatting & Confidence Calculations)
  // =========================================================================

  /**
   * Safely formats currency with configurable symbol.
   */
  function formatCurrency(val) {
    if (val === null || val === undefined || isNaN(val)) {
      return 'N/A';
    }
    return `${CONFIG.CURRENCY_SYMBOL}${Number(val).toFixed(2)}`;
  }

  /**
   * Safely formats numbers with commas.
   */
  function formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) {
      return '0';
    }
    return Number(val).toLocaleString();
  }

  /**
   * Returns confidence CSS class for a given percentage.
   */
  function getConfidenceClass(percent) {
    if (percent === null || percent === undefined || isNaN(percent)) {
      return 'none';
    }
    if (percent >= CONFIG.MATCH_THRESHOLDS.HIGH) return 'high';
    if (percent >= CONFIG.MATCH_THRESHOLDS.MID) return 'mid';
    return 'low';
  }

  /**
   * Formats confidence percentage text.
   */
  function formatConfidenceText(percent) {
    if (percent === null || percent === undefined || isNaN(percent)) {
      return 'Not evaluated';
    }
    return `${Math.round(percent)}%`;
  }

  /**
   * Creates an inline SVG placeholder element for missing or failed images.
   */
  function createImageUnavailableElement() {
    const box = document.createElement('div');
    box.className = 'image-unavailable-placeholder';

    // SVG icon for missing image
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    // Camera / Image outline with diagonal slash
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', '3');
    rect.setAttribute('y', '3');
    rect.setAttribute('width', '18');
    rect.setAttribute('height', '18');
    rect.setAttribute('rx', '2');
    rect.setAttribute('ry', '2');

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '8.5');
    circle.setAttribute('cy', '8.5');
    circle.setAttribute('r', '1.5');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M21 15l-5-5L5 21');

    const slash = document.createElementNS(svgNS, 'line');
    slash.setAttribute('x1', '2');
    slash.setAttribute('y1', '2');
    slash.setAttribute('x2', '22');
    slash.setAttribute('y2', '22');

    svg.appendChild(rect);
    svg.appendChild(circle);
    svg.appendChild(path);
    svg.appendChild(slash);

    const text = document.createElement('span');
    text.textContent = 'Image unavailable';

    box.appendChild(svg);
    box.appendChild(text);
    return box;
  }

  // =========================================================================
  // Data Fetching & Sync Logic
  // =========================================================================

  /**
   * Fetches products JSON from local storage with cache busting.
   * Handles non-blocking errors, validates schema, and avoids DOM flickering.
   */
  async function fetchProducts(isManual = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    if (isManual) {
      DOM.refreshBtn.classList.add('loading');
      DOM.refreshBtn.disabled = true;
      setSyncStatus('loading', 'Syncing...');
    }

    try {
      // Bust cache using timestamp parameter
      const cacheBustUrl = `${CONFIG.DATA_URL}?_t=${Date.now()}`;
      const response = await fetch(cacheBustUrl, {
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText} (${CONFIG.DATA_URL})`);
      }

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (jsonErr) {
        throw new Error(`JSON parsing failed: ${jsonErr.message}`);
      }

      // Check if schema is valid
      if (!data || !Array.isArray(data.products)) {
        throw new Error('Invalid schema: Missing "products" array in data/products.json');
      }

      // Dismiss any existing warning banner on success
      hideNotification();
      setSyncStatus('active', 'Live Sync Active');

      // Check if data actually changed to avoid unnecessary re-rendering
      const currentHash = rawText;
      const dataChanged = currentHash !== state.lastRawDataHash;

      if (dataChanged || state.catalogData === null) {
        state.lastRawDataHash = currentHash;
        state.catalogData = data;
        state.products = data.products || [];

        // Update Header KPIs & dropdown options
        updateHeaderKPIs();
        updateCategoryOptions();

        // Render products with current filter/sort state
        applyFiltersAndRender();
      }

      // Update timestamp display
      updateLastUpdatedDisplay(data.last_updated);

    } catch (err) {
      console.warn('Fetch products warning:', err.message);
      setSyncStatus('error', 'Sync Issue');
      showNotification(`Warning: Unable to read updated product data (${err.message}). Retaining current inventory.`, 'warning');
    } finally {
      state.isLoading = false;
      if (isManual) {
        DOM.refreshBtn.classList.remove('loading');
        DOM.refreshBtn.disabled = false;
      }
    }
  }

  /**
   * Updates sync status badge indicator in header.
   */
  function setSyncStatus(status, text) {
    DOM.syncPulseDot.className = 'pulse-dot';
    if (status === 'error') {
      DOM.syncPulseDot.classList.add('error');
    } else if (status === 'loading') {
      DOM.syncPulseDot.classList.add('loading');
    }
    DOM.syncStatusText.textContent = text;
  }

  /**
   * Formats and updates the last updated timestamp.
   */
  function updateLastUpdatedDisplay(timestamp) {
    if (timestamp) {
      try {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          DOM.lastUpdatedValue.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          return;
        }
      } catch (_) {}
      DOM.lastUpdatedValue.textContent = String(timestamp);
    } else {
      DOM.lastUpdatedValue.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  /**
   * Non-blocking notification banner.
   */
  function showNotification(msg, type = 'warning') {
    DOM.notificationMessage.textContent = msg;
    DOM.notificationBanner.className = `notification-banner ${type}`;
    DOM.notificationBanner.style.display = 'flex';
  }

  function hideNotification() {
    DOM.notificationBanner.style.display = 'none';
  }

  // =========================================================================
  // Header KPI Calculations
  // =========================================================================

  function updateHeaderKPIs() {
    const products = state.products;
    const total = products.length;

    let activeCount = 0;
    let inactiveCount = 0;
    const categoriesSet = new Set();
    let generatedImageCount = 0;

    for (let i = 0; i < total; i++) {
      const p = products[i];
      if (p.status === 'ACTIVE') {
        activeCount++;
      } else if (p.status === 'INACTIVE') {
        inactiveCount++;
      }

      if (p.category && String(p.category).trim() !== '') {
        categoriesSet.add(String(p.category).trim());
      }

      if (p.image_status === 'generated' || (p.image && String(p.image).trim() !== '')) {
        generatedImageCount++;
      }
    }

    DOM.kpiTotalProducts.textContent = formatNumber(total);
    DOM.kpiActiveProducts.textContent = formatNumber(activeCount);
    DOM.kpiInactiveProducts.textContent = formatNumber(inactiveCount);
    DOM.kpiTotalCategories.textContent = formatNumber(categoriesSet.size);
    DOM.kpiGeneratedImages.textContent = formatNumber(generatedImageCount);

    if (state.catalogData && state.catalogData.catalog_name) {
      DOM.footerCatalogName.textContent = state.catalogData.catalog_name;
    }
  }

  // =========================================================================
  // Filter & Search Controls Handling
  // =========================================================================

  /**
   * Dynamically populates Category and Subcategory dropdowns based on available data,
   * preserving any active user selection.
   */
  function updateCategoryOptions() {
    const previousCategory = state.filters.category;
    const previousSubcategory = state.filters.subcategory;

    const categories = new Set();
    const subcategoriesByCategory = new Map();

    state.products.forEach(p => {
      const cat = p.category ? String(p.category).trim() : null;
      const sub = p.subcategory ? String(p.subcategory).trim() : null;

      if (cat) {
        categories.add(cat);
        if (!subcategoriesByCategory.has(cat)) {
          subcategoriesByCategory.set(cat, new Set());
        }
        if (sub) {
          subcategoriesByCategory.get(cat).add(sub);
        }
      }
    });

    // Populate Category Select
    DOM.categoryFilter.innerHTML = '';
    const allCatOpt = document.createElement('option');
    allCatOpt.value = 'ALL';
    allCatOpt.textContent = 'All Categories';
    DOM.categoryFilter.appendChild(allCatOpt);

    const sortedCats = Array.from(categories).sort();
    sortedCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      DOM.categoryFilter.appendChild(opt);
    });

    if (categories.has(previousCategory)) {
      DOM.categoryFilter.value = previousCategory;
      state.filters.category = previousCategory;
    } else {
      DOM.categoryFilter.value = 'ALL';
      state.filters.category = 'ALL';
    }

    // Populate Subcategory Select
    updateSubcategoryOptions(previousSubcategory);
  }

  function updateSubcategoryOptions(desiredSubcategory = state.filters.subcategory) {
    const selectedCategory = state.filters.category;
    let availableSubs = new Set();

    if (selectedCategory === 'ALL') {
      state.products.forEach(p => {
        if (p.subcategory && String(p.subcategory).trim() !== '') {
          availableSubs.add(String(p.subcategory).trim());
        }
      });
    } else {
      state.products.forEach(p => {
        if (p.category === selectedCategory && p.subcategory && String(p.subcategory).trim() !== '') {
          availableSubs.add(String(p.subcategory).trim());
        }
      });
    }

    DOM.subcategoryFilter.innerHTML = '';
    const allSubOpt = document.createElement('option');
    allSubOpt.value = 'ALL';
    allSubOpt.textContent = 'All Subcategories';
    DOM.subcategoryFilter.appendChild(allSubOpt);

    const sortedSubs = Array.from(availableSubs).sort();
    sortedSubs.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = sub;
      DOM.subcategoryFilter.appendChild(opt);
    });

    if (availableSubs.has(desiredSubcategory)) {
      DOM.subcategoryFilter.value = desiredSubcategory;
      state.filters.subcategory = desiredSubcategory;
    } else {
      DOM.subcategoryFilter.value = 'ALL';
      state.filters.subcategory = 'ALL';
    }
  }

  /**
   * Applies active search, filter, and sort conditions, then re-renders the grid.
   */
  function applyFiltersAndRender() {
    const { search, category, subcategory, status, sortBy } = state.filters;
    const query = search.trim().toLowerCase();

    // 1. Filtering
    const filtered = state.products.filter(p => {
      // Category Filter
      if (category !== 'ALL' && p.category !== category) {
        return false;
      }

      // Subcategory Filter
      if (subcategory !== 'ALL' && p.subcategory !== subcategory) {
        return false;
      }

      // Status Filter
      if (status !== 'ALL' && (p.status || '').toUpperCase() !== status) {
        return false;
      }

      // Search (title, item_no, description, vendor)
      if (query !== '') {
        const title = (p.product_title || '').toLowerCase();
        const itemNo = (p.item_no || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const vendor = (p.vendor || '').toLowerCase();

        const matches = title.includes(query) ||
                        itemNo.includes(query) ||
                        desc.includes(query) ||
                        vendor.includes(query);
        if (!matches) return false;
      }

      return true;
    });

    // 2. Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title_asc':
          return (a.product_title || '').localeCompare(b.product_title || '');
        case 'title_desc':
          return (b.product_title || '').localeCompare(a.product_title || '');
        case 'price_asc': {
          const pA = a.list_price !== null && a.list_price !== undefined ? a.list_price : Infinity;
          const pB = b.list_price !== null && b.list_price !== undefined ? b.list_price : Infinity;
          return pA - pB;
        }
        case 'price_desc': {
          const pA = a.list_price !== null && a.list_price !== undefined ? a.list_price : -Infinity;
          const pB = b.list_price !== null && b.list_price !== undefined ? b.list_price : -Infinity;
          return pB - pA;
        }
        case 'category_match_desc': {
          const cA = a.category_match_percent !== null && a.category_match_percent !== undefined ? a.category_match_percent : -Infinity;
          const cB = b.category_match_percent !== null && b.category_match_percent !== undefined ? b.category_match_percent : -Infinity;
          return cB - cA;
        }
        case 'image_match_desc': {
          const iA = a.image_match_percent !== null && a.image_match_percent !== undefined ? a.image_match_percent : -Infinity;
          const iB = b.image_match_percent !== null && b.image_match_percent !== undefined ? b.image_match_percent : -Infinity;
          return iB - iA;
        }
        default:
          return 0;
      }
    });

    // 3. Render Count & Active Filter Chips
    DOM.visibleCount.textContent = formatNumber(filtered.length);
    DOM.totalCount.textContent = formatNumber(state.products.length);
    renderActiveFilterChips();

    // 4. Render Grid Cards or Empty States
    renderProductGrid(filtered);
  }

  /**
   * Renders active filter indicator tags with click-to-remove capability.
   */
  function renderActiveFilterChips() {
    DOM.activeFilterChips.innerHTML = '';
    const { search, category, subcategory, status } = state.filters;

    if (search.trim() !== '') {
      addChip(`Search: "${search}"`, () => {
        state.filters.search = '';
        DOM.searchInput.value = '';
        DOM.searchClearBtn.style.display = 'none';
        applyFiltersAndRender();
      });
    }

    if (category !== 'ALL') {
      addChip(`Category: ${category}`, () => {
        state.filters.category = 'ALL';
        DOM.categoryFilter.value = 'ALL';
        updateSubcategoryOptions();
        applyFiltersAndRender();
      });
    }

    if (subcategory !== 'ALL') {
      addChip(`Subcategory: ${subcategory}`, () => {
        state.filters.subcategory = 'ALL';
        DOM.subcategoryFilter.value = 'ALL';
        applyFiltersAndRender();
      });
    }

    if (status !== 'ALL') {
      addChip(`Status: ${status}`, () => {
        state.filters.status = 'ALL';
        DOM.statusFilter.value = 'ALL';
        applyFiltersAndRender();
      });
    }
  }

  function addChip(label, onRemove) {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';

    const text = document.createElement('span');
    text.textContent = label;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-chip-remove';
    btn.setAttribute('aria-label', `Remove filter ${label}`);
    btn.innerHTML = '&times;';
    btn.addEventListener('click', onRemove);

    chip.appendChild(text);
    chip.appendChild(btn);
    DOM.activeFilterChips.appendChild(chip);
  }

  // =========================================================================
  // Product Card Rendering (Pure Safe DOM Creation - No Raw innerHTML)
  // =========================================================================

  /**
   * Renders product list into the grid container.
   */
  function renderProductGrid(products) {
    DOM.productGrid.innerHTML = '';

    // Condition 1: Global Empty State (JSON has 0 total products)
    if (state.products.length === 0) {
      renderGlobalEmptyState();
      return;
    }

    // Condition 2: Filter Empty State (Filtered results has 0 products)
    if (products.length === 0) {
      renderFilteredEmptyState();
      return;
    }

    // Render each product card using safe DOM construction
    const fragment = document.createDocumentFragment();
    products.forEach(product => {
      const card = createProductCard(product);
      fragment.appendChild(card);
    });

    DOM.productGrid.appendChild(fragment);
  }

  /**
   * Renders the mandatory empty state when products.json is empty.
   */
  function renderGlobalEmptyState() {
    const box = document.createElement('div');
    box.className = 'empty-state-box';

    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>`;

    const title = document.createElement('h3');
    title.className = 'empty-state-title';
    title.textContent = 'No products available. Add product records to data/products.json to begin.';

    const desc = document.createElement('p');
    desc.className = 'empty-state-desc';
    desc.textContent = 'The catalog viewer is active and continuously listening for inventory updates. Once new product records are added to the JSON data file, they will automatically appear here without requiring a page reload.';

    const code = document.createElement('span');
    code.className = 'empty-state-code';
    code.textContent = 'Awaiting data in data/products.json...';

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(code);

    DOM.productGrid.appendChild(box);
  }

  /**
   * Renders empty state when active filters match zero items.
   */
  function renderFilteredEmptyState() {
    const box = document.createElement('div');
    box.className = 'empty-state-box';

    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      <line x1="8" y1="11" x2="14" y2="11"></line>
    </svg>`;

    const title = document.createElement('h3');
    title.className = 'empty-state-title';
    title.textContent = 'No matching products found';

    const desc = document.createElement('p');
    desc.className = 'empty-state-desc';
    desc.textContent = 'No inventory items match your current search query and filter combination. Try adjusting your search keywords or resetting filters.';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn-secondary';
    resetBtn.textContent = 'Reset All Filters';
    resetBtn.style.marginTop = '0.5rem';
    resetBtn.addEventListener('click', resetAllFilters);

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(resetBtn);

    DOM.productGrid.appendChild(box);
  }

  /**
   * Constructs a single product card DOM element with all sections A through E.
   */
  function createProductCard(product) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('data-item-no', product.item_no || '');

    // =======================================================================
    // Section A: Product Image (1:1 Aspect Ratio, object-fit contain, modal click)
    // =======================================================================
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'card-image-wrapper';
    imageWrapper.setAttribute('role', 'button');
    imageWrapper.setAttribute('tabindex', '0');
    imageWrapper.setAttribute('aria-label', `View high-resolution image for ${product.product_title || product.item_no}`);

    const zoomHint = document.createElement('div');
    zoomHint.className = 'image-zoom-hint';
    zoomHint.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg> Zoom`;
    imageWrapper.appendChild(zoomHint);

    if (product.image && typeof product.image === 'string' && product.image.trim() !== '') {
      const img = document.createElement('img');
      img.className = 'card-image';
      img.src = product.image;
      img.alt = product.product_title || `Item ${product.item_no}`;
      img.loading = 'lazy';

      // Missing or broken image handler
      img.onerror = function () {
        imageWrapper.innerHTML = '';
        imageWrapper.appendChild(createImageUnavailableElement());
      };

      imageWrapper.appendChild(img);
    } else {
      imageWrapper.appendChild(createImageUnavailableElement());
    }

    // Modal Trigger click and enter key
    imageWrapper.addEventListener('click', () => openImageModal(product));
    imageWrapper.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openImageModal(product);
      }
    });

    card.appendChild(imageWrapper);

    // Card Content Container
    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';

    // =======================================================================
    // Section B: Product Identification (Title, Item No, Original Description)
    // =======================================================================
    const sectionB = document.createElement('div');
    sectionB.className = 'card-section-identification';

    const itemNoRow = document.createElement('div');
    itemNoRow.className = 'item-no-row';

    const itemNoBadge = document.createElement('span');
    itemNoBadge.className = 'item-no-badge';
    itemNoBadge.textContent = `ITEM # ${product.item_no || 'N/A'}`;
    itemNoRow.appendChild(itemNoBadge);

    // Status Pill in Identification row for high visibility
    const statusPill = document.createElement('span');
    const isProductActive = (product.status || '').toUpperCase() === 'ACTIVE';
    statusPill.className = `status-pill ${isProductActive ? 'active' : 'inactive'}`;

    const statusDot = document.createElement('span');
    statusDot.className = 'status-dot';
    statusPill.appendChild(statusDot);

    const statusText = document.createTextNode(isProductActive ? 'ACTIVE' : 'INACTIVE');
    statusPill.appendChild(statusText);
    itemNoRow.appendChild(statusPill);

    const titleEl = document.createElement('h3');
    titleEl.className = 'card-title';
    titleEl.textContent = product.product_title || 'Untitled Product';
    titleEl.title = product.product_title || '';

    const descEl = document.createElement('p');
    descEl.className = 'card-description';
    descEl.textContent = product.description || 'No original description provided.';
    descEl.title = product.description || '';

    sectionB.appendChild(itemNoRow);
    sectionB.appendChild(titleEl);
    sectionB.appendChild(descEl);
    cardContent.appendChild(sectionB);

    // =======================================================================
    // Section C: Category & Subcategory + Category Match %
    // =======================================================================
    const sectionC = document.createElement('div');
    sectionC.className = 'card-section-category';

    const catBreadcrumbs = document.createElement('div');
    catBreadcrumbs.className = 'category-breadcrumbs';

    const catMain = document.createElement('span');
    catMain.className = 'cat-main';
    catMain.textContent = product.category ? `Category: ${product.category}` : 'Category: Unassigned';

    const catSub = document.createElement('span');
    catSub.className = 'cat-sub';
    catSub.textContent = product.subcategory ? `Subcategory: ${product.subcategory}` : 'Subcategory: N/A';

    catBreadcrumbs.appendChild(catMain);
    catBreadcrumbs.appendChild(catSub);

    const catMatchBadge = document.createElement('div');
    catMatchBadge.className = 'category-match-badge';

    const catMatchLabel = document.createElement('span');
    catMatchLabel.className = 'match-score-label';
    catMatchLabel.textContent = 'Category Match';

    const catMatchVal = document.createElement('span');
    const catScore = product.category_match_percent;
    const catScoreClass = getConfidenceClass(catScore);
    catMatchVal.className = `match-score-value ${catScoreClass}`;
    catMatchVal.textContent = formatConfidenceText(catScore);

    catMatchBadge.appendChild(catMatchLabel);
    catMatchBadge.appendChild(catMatchVal);

    sectionC.appendChild(catBreadcrumbs);
    sectionC.appendChild(catMatchBadge);
    cardContent.appendChild(sectionC);

    // =======================================================================
    // Section D: Product Information (Two-Column Spec Grid)
    // =======================================================================
    const sectionD = document.createElement('div');
    sectionD.className = 'card-section-info';

    const infoGrid = document.createElement('div');
    infoGrid.className = 'info-grid';

    // 1. List Price
    infoGrid.appendChild(createInfoItem('List Price', formatCurrency(product.list_price), 'price'));

    // 2. Average Cost
    infoGrid.appendChild(createInfoItem('Average Cost', formatCurrency(product.avg_cost), 'cost'));

    // 3. UOM
    infoGrid.appendChild(createInfoItem('UOM', product.uom || 'EA'));

    // 4. Package Quantity
    infoGrid.appendChild(createInfoItem('Package Quantity', formatNumber(product.pkg_qty)));

    // 5. Quantity on Hand
    infoGrid.appendChild(createInfoItem('Quantity on Hand', formatNumber(product.qty_on_hand)));

    // 6. Sales Quantity (12M)
    infoGrid.appendChild(createInfoItem('Sales Quantity (12M)', formatNumber(product.sales_qty_12m)));

    // 7. Vendor (Full width if necessary)
    infoGrid.appendChild(createInfoItem('Vendor', product.vendor || 'N/A', 'full-width'));

    // 8. Manufacturer Part Number
    const mfrPart = product.mfr_part_no && String(product.mfr_part_no).trim() !== '' ? product.mfr_part_no : 'N/A';
    infoGrid.appendChild(createInfoItem('Manufacturer Part Number', mfrPart, 'full-width'));

    sectionD.appendChild(infoGrid);
    cardContent.appendChild(sectionD);
    card.appendChild(cardContent);

    // =======================================================================
    // Section E: AI Image Matching (Progress bar, thresholds, status)
    // =======================================================================
    const sectionE = document.createElement('div');
    sectionE.className = 'card-section-ai';

    const aiHeader = document.createElement('div');
    aiHeader.className = 'ai-match-header';

    const aiTitle = document.createElement('span');
    aiTitle.className = 'ai-match-title';
    aiTitle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> AI Image Match`;

    const aiScore = document.createElement('span');
    const imgScore = product.image_match_percent;
    const imgScoreClass = getConfidenceClass(imgScore);
    aiScore.className = `ai-match-score ${imgScoreClass}`;
    aiScore.textContent = formatConfidenceText(imgScore);

    aiHeader.appendChild(aiTitle);
    aiHeader.appendChild(aiScore);

    // Horizontal Progress Bar
    const progressTrack = document.createElement('div');
    progressTrack.className = 'progress-track';

    const progressFill = document.createElement('div');
    progressFill.className = `progress-fill ${imgScoreClass}`;
    if (imgScore !== null && imgScore !== undefined && !isNaN(imgScore)) {
      const clampedScore = Math.max(0, Math.min(100, imgScore));
      progressFill.style.width = `${clampedScore}%`;
    } else {
      progressFill.style.width = '0%';
    }
    progressTrack.appendChild(progressFill);

    // AI Footer (Status & Label)
    const aiFooter = document.createElement('div');
    aiFooter.className = 'ai-match-footer';

    const sourceLabel = document.createElement('span');
    sourceLabel.className = 'ai-source-label';
    sourceLabel.textContent = product.image_source || 'AI Generated Image';

    const statusTextEl = document.createElement('span');
    statusTextEl.className = 'ai-status-text';
    statusTextEl.textContent = product.image_status ? `Status: ${product.image_status}` : 'Status: N/A';

    aiFooter.appendChild(sourceLabel);
    aiFooter.appendChild(statusTextEl);

    sectionE.appendChild(aiHeader);
    sectionE.appendChild(progressTrack);
    sectionE.appendChild(aiFooter);

    card.appendChild(sectionE);

    return card;
  }

  /**
   * Helper to construct a standard label/value pair item.
   */
  function createInfoItem(labelText, valueText, extraClass = '') {
    const item = document.createElement('div');
    item.className = `info-item ${extraClass}`.trim();

    const label = document.createElement('span');
    label.className = 'info-label';
    label.textContent = labelText;

    const val = document.createElement('span');
    val.className = `info-value ${extraClass}`.trim();
    val.textContent = valueText;
    val.title = valueText;

    item.appendChild(label);
    item.appendChild(val);
    return item;
  }

  // =========================================================================
  // Product Image Modal Handling
  // =========================================================================

  function openImageModal(product) {
    state.activeModalProduct = product;

    DOM.modalItemNo.textContent = `ITEM # ${product.item_no || 'N/A'}`;
    DOM.modalProductTitle.textContent = product.product_title || 'Product Image Preview';
    DOM.modalCategory.textContent = `${product.category || 'Unassigned'} / ${product.subcategory || 'N/A'}`;
    DOM.modalPriceInfo.textContent = `${formatCurrency(product.list_price)} / ${product.uom || 'EA'}`;
    DOM.modalVendor.textContent = product.vendor || 'N/A';

    // Image Setup
    if (product.image && typeof product.image === 'string' && product.image.trim() !== '') {
      DOM.modalImage.src = product.image;
      DOM.modalImage.alt = product.product_title || 'Product Image';
      DOM.modalImage.style.display = 'block';

      DOM.modalImage.onerror = function () {
        DOM.modalImage.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Cline x1="2" y1="2" x2="22" y2="22"/%3E%3C/svg%3E';
      };
    } else {
      DOM.modalImage.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Cline x1="2" y1="2" x2="22" y2="22"/%3E%3C/svg%3E';
    }

    // AI Confidence in Modal
    const imgScore = product.image_match_percent;
    const scoreClass = getConfidenceClass(imgScore);
    DOM.modalImageMatchVal.className = `modal-detail-val ${scoreClass}`;
    DOM.modalImageMatchVal.textContent = formatConfidenceText(imgScore);

    DOM.modalImageMatchProgress.className = `progress-fill ${scoreClass}`;
    if (imgScore !== null && imgScore !== undefined && !isNaN(imgScore)) {
      DOM.modalImageMatchProgress.style.width = `${Math.max(0, Math.min(100, imgScore))}%`;
    } else {
      DOM.modalImageMatchProgress.style.width = '0%';
    }

    const source = product.image_source || 'AI Generated Image';
    const status = product.image_status || 'generated';
    DOM.modalImageStatus.textContent = `${source} (${status})`;

    // Display modal
    DOM.imageModal.classList.add('open');
    DOM.imageModal.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeImageModal() {
    state.activeModalProduct = null;
    DOM.imageModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // =========================================================================
  // Event Listeners & Initialization
  // =========================================================================

  function resetAllFilters() {
    state.filters.search = '';
    state.filters.category = 'ALL';
    state.filters.subcategory = 'ALL';
    state.filters.status = 'ALL';
    state.filters.sortBy = 'title_asc';

    DOM.searchInput.value = '';
    DOM.searchClearBtn.style.display = 'none';
    DOM.categoryFilter.value = 'ALL';
    DOM.statusFilter.value = 'ALL';
    DOM.sortBySelect.value = 'title_asc';

    updateSubcategoryOptions();
    applyFiltersAndRender();
  }

  function setupEventListeners() {
    // Search Input with Debounce / Immediate Feedback
    DOM.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      state.filters.search = val;
      DOM.searchClearBtn.style.display = val.length > 0 ? 'block' : 'none';
      applyFiltersAndRender();
    });

    DOM.searchClearBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      state.filters.search = '';
      DOM.searchClearBtn.style.display = 'none';
      DOM.searchInput.focus();
      applyFiltersAndRender();
    });

    // Category Filter Change
    DOM.categoryFilter.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      updateSubcategoryOptions();
      applyFiltersAndRender();
    });

    // Subcategory Filter Change
    DOM.subcategoryFilter.addEventListener('change', (e) => {
      state.filters.subcategory = e.target.value;
      applyFiltersAndRender();
    });

    // Status Filter Change
    DOM.statusFilter.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      applyFiltersAndRender();
    });

    // Sort By Change
    DOM.sortBySelect.addEventListener('change', (e) => {
      state.filters.sortBy = e.target.value;
      applyFiltersAndRender();
    });

    // Action Buttons
    DOM.resetFiltersBtn.addEventListener('click', resetAllFilters);
    DOM.refreshBtn.addEventListener('click', () => fetchProducts(true));

    // Notification Banner Close Button
    DOM.notificationCloseBtn.addEventListener('click', hideNotification);

    // Modal Events
    DOM.modalCloseBtn.addEventListener('click', closeImageModal);
    DOM.imageModal.addEventListener('click', (e) => {
      // Close on backdrop click (click outside modal dialog)
      if (e.target === DOM.imageModal) {
        closeImageModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      // Close on Escape key
      if (e.key === 'Escape' && DOM.imageModal.classList.contains('open')) {
        closeImageModal();
      }
      // Keyboard shortcut '/' to quickly focus search
      if (e.key === '/' && document.activeElement !== DOM.searchInput && !DOM.imageModal.classList.contains('open')) {
        e.preventDefault();
        DOM.searchInput.focus();
      }
    });
  }

  /**
   * Initializes polling timer every 5000ms.
   */
  function startPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
    }
    state.pollTimer = setInterval(() => {
      fetchProducts(false);
    }, CONFIG.POLL_INTERVAL_MS);
  }

  /**
   * Application Bootstrapper
   */
  function init() {
    setupEventListeners();
    fetchProducts(false);
    startPolling();
  }

  // Kickoff on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

