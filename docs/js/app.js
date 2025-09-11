/**
 * Main Application Logic for Acupuncture 3D SPA
 * 
 * Handles search functionality, data loading, and UI interactions
 * TODO: Add internationalization (i18n) support
 * TODO: Add API integration for external acupoint data
 * TODO: Add meridian filtering functionality
 */

class AcupunctureApp {
  constructor() {
    this.acupoints = [];
    this.scene3D = null;
    this.currentFilter = '';
    
    this.initializeDOM();
    this.loadAcupointData();
    this.setupEventListeners();
  }

  /**
   * Initialize DOM references
   */
  initializeDOM() {
    this.elements = {
      searchInput: document.getElementById('search-input'),
      searchResults: document.getElementById('search-results'),
      selectedInfo: document.getElementById('selected-info'),
      clearButton: document.getElementById('clear-selection'),
      loadingIndicator: document.getElementById('loading')
    };
  }

  /**
   * Load acupoint data from JSON file
   * TODO: Replace with API call for production
   */
  async loadAcupointData() {
    try {
      this.showLoading(true);
      const response = await fetch('./data/acupoints.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.acupoints = await response.json();
      this.initializeScene();
      this.showLoading(false);
      console.log(`Loaded ${this.acupoints.length} acupoints`);
    } catch (error) {
      console.error('Error loading acupoint data:', error);
      this.showError('Failed to load acupoint data. Please refresh the page.');
    }
  }

  /**
   * Initialize the 3D scene
   */
  initializeScene() {
    try {
      this.scene3D = new Scene3D('scene-container');
      console.log('3D scene initialized successfully');
    } catch (error) {
      console.error('Error initializing 3D scene:', error);
      this.showError('Failed to initialize 3D visualization. Please check your browser compatibility.');
    }
  }

  /**
   * Set up event listeners for UI interactions
   */
  setupEventListeners() {
    // Search input with debouncing
    let searchTimeout;
    this.elements.searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.handleSearch(e.target.value);
      }, 300);
    });

    // Clear selection button
    this.elements.clearButton?.addEventListener('click', () => {
      this.clearSelection();
    });

    // Keyboard navigation for search results
    this.elements.searchInput?.addEventListener('keydown', (e) => {
      this.handleKeyboardNavigation(e);
    });

    // Click outside to clear selection
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container') && 
          !e.target.closest('#selected-info')) {
        this.clearSearchResults();
      }
    });
  }

  /**
   * Handle search functionality with multiple criteria
   */
  handleSearch(query) {
    this.currentFilter = query.trim().toLowerCase();
    
    if (this.currentFilter.length < 1) {
      this.clearSearchResults();
      return;
    }

    const filteredAcupoints = this.acupoints.filter(acupoint => {
      return (
        acupoint.name_ja.toLowerCase().includes(this.currentFilter) ||
        acupoint.name_en.toLowerCase().includes(this.currentFilter) ||
        acupoint.id.toLowerCase().includes(this.currentFilter) ||
        acupoint.meridian.toLowerCase().includes(this.currentFilter)
      );
    });

    this.displaySearchResults(filteredAcupoints);
  }

  /**
   * Display search results in the UI
   */
  displaySearchResults(results) {
    if (!this.elements.searchResults) return;

    this.elements.searchResults.innerHTML = '';
    
    if (results.length === 0) {
      this.elements.searchResults.innerHTML = '<div class="no-results">No acupoints found</div>';
      this.elements.searchResults.classList.add('visible');
      return;
    }

    results.forEach((acupoint, index) => {
      const resultItem = document.createElement('div');
      resultItem.className = 'result-item';
      resultItem.dataset.index = index;
      resultItem.innerHTML = `
        <div class="result-primary">
          <strong>${acupoint.name_ja}</strong>
          <span class="result-english">${acupoint.name_en}</span>
        </div>
        <div class="result-secondary">
          <span class="result-id">${acupoint.id}</span>
          <span class="result-meridian">${acupoint.meridian}</span>
        </div>
      `;
      
      resultItem.addEventListener('click', () => {
        this.selectAcupoint(acupoint);
      });
      
      this.elements.searchResults.appendChild(resultItem);
    });

    this.elements.searchResults.classList.add('visible');
  }

  /**
   * Handle keyboard navigation in search results
   */
  handleKeyboardNavigation(e) {
    const results = this.elements.searchResults?.querySelectorAll('.result-item');
    if (!results || results.length === 0) return;

    const currentActive = this.elements.searchResults?.querySelector('.result-item.active');
    let activeIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        activeIndex = (activeIndex + 1) % results.length;
        this.setActiveResult(results, activeIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        activeIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
        this.setActiveResult(results, activeIndex);
        break;
      case 'Enter':
        e.preventDefault();
        if (currentActive) {
          const acupointId = results[activeIndex]?.querySelector('.result-id')?.textContent;
          const acupoint = this.acupoints.find(ap => ap.id === acupointId);
          if (acupoint) {
            this.selectAcupoint(acupoint);
          }
        }
        break;
      case 'Escape':
        this.clearSearchResults();
        break;
    }
  }

  /**
   * Set active result item for keyboard navigation
   */
  setActiveResult(results, activeIndex) {
    results.forEach(result => result.classList.remove('active'));
    if (results[activeIndex]) {
      results[activeIndex].classList.add('active');
      results[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Select an acupoint and highlight it in 3D scene
   */
  selectAcupoint(acupoint) {
    console.log('Selected acupoint:', acupoint);
    
    // Highlight in 3D scene
    if (this.scene3D) {
      this.scene3D.highlightAcupoint(acupoint);
    }
    
    // Update info panel
    this.displayAcupointInfo(acupoint);
    
    // Clear search results
    this.clearSearchResults();
    
    // Update search input with selected item
    if (this.elements.searchInput) {
      this.elements.searchInput.value = `${acupoint.name_ja} (${acupoint.name_en})`;
    }
  }

  /**
   * Display detailed information about selected acupoint
   */
  displayAcupointInfo(acupoint) {
    if (!this.elements.selectedInfo) return;

    this.elements.selectedInfo.innerHTML = `
      <div class="info-header">
        <h3>${acupoint.name_ja}</h3>
        <p class="info-english">${acupoint.name_en}</p>
        <p class="info-code">Code: ${acupoint.id}</p>
      </div>
      <div class="info-body">
        <div class="info-section">
          <h4>Meridian</h4>
          <p>${acupoint.meridian}</p>
        </div>
        <div class="info-section">
          <h4>Position (3D Coordinates)</h4>
          <p>X: ${acupoint.position.x.toFixed(1)}, Y: ${acupoint.position.y.toFixed(1)}, Z: ${acupoint.position.z.toFixed(1)}</p>
        </div>
        <div class="info-section">
          <h4>Description</h4>
          <p>${acupoint.description}</p>
        </div>
      </div>
    `;
    
    this.elements.selectedInfo.classList.add('visible');
    this.elements.clearButton?.classList.add('visible');
  }

  /**
   * Clear current selection
   */
  clearSelection() {
    if (this.scene3D) {
      this.scene3D.clearHighlights();
    }
    
    this.elements.selectedInfo?.classList.remove('visible');
    this.elements.clearButton?.classList.remove('visible');
    
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
    }
    
    this.clearSearchResults();
  }

  /**
   * Clear search results display
   */
  clearSearchResults() {
    if (this.elements.searchResults) {
      this.elements.searchResults.classList.remove('visible');
      this.elements.searchResults.innerHTML = '';
    }
  }

  /**
   * Show/hide loading indicator
   */
  showLoading(show) {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Display error message to user
   */
  showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
      <div class="error-content">
        <strong>Error:</strong> ${message}
        <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }
}

/**
 * Initialize application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check for WebGL support
  if (!window.WebGLRenderingContext) {
    console.error('WebGL is not supported in this browser');
    document.body.innerHTML = '<div class="error-message">WebGL is required but not supported in your browser. Please use a modern browser with WebGL support.</div>';
    return;
  }

  // Initialize the application
  window.acupunctureApp = new AcupunctureApp();
  console.log('Acupuncture 3D SPA initialized successfully');
});

/**
 * Performance optimization: Preload Three.js modules
 * TODO: Consider using a module bundler like Vite for production
 */
const preloadModules = [
  'https://unpkg.com/three@0.158.0/build/three.module.js',
  'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js'
];

preloadModules.forEach(url => {
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = url;
  document.head.appendChild(link);
});