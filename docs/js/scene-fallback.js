/**
 * Fallback 3D Scene for environments without Three.js CDN access
 * 
 * This provides a simple 2D visualization as fallback while maintaining the same API
 * TODO: Replace with full Three.js implementation when CDN is available
 */

class Scene3DFallback {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = null;
    this.ctx = null;
    this.acupointMarkers = [];
    this.selectedMarker = null;
    this.mannequinPoints = [];
    
    this.init();
    this.createMannequin();
    this.animate();
  }

  init() {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.background = 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)';
    this.canvas.style.borderRadius = '0.75rem';
    
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize(), false);
    
    // Add some interactivity
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    
    console.log('Fallback 2D scene initialized');
  }

  createMannequin() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Define mannequin structure with relative coordinates
    this.mannequinPoints = [
      // Head
      { x: centerX, y: centerY - 180, radius: 40, type: 'head' },
      // Torso points
      { x: centerX, y: centerY - 100, radius: 8, type: 'torso' },
      { x: centerX, y: centerY - 50, radius: 8, type: 'torso' },
      { x: centerX, y: centerY, radius: 8, type: 'torso' },
      { x: centerX, y: centerY + 50, radius: 8, type: 'torso' },
      // Arms
      { x: centerX - 60, y: centerY - 80, radius: 6, type: 'arm' },
      { x: centerX + 60, y: centerY - 80, radius: 6, type: 'arm' },
      // Legs
      { x: centerX - 20, y: centerY + 120, radius: 8, type: 'leg' },
      { x: centerX + 20, y: centerY + 120, radius: 8, type: 'leg' },
    ];
  }

  drawMannequin() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw simple mannequin
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.fillStyle = '#DEB887';
    this.ctx.lineWidth = 3;
    
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Head
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY - 180, 40, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Body line
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY - 140);
    this.ctx.lineTo(centerX, centerY + 50);
    this.ctx.stroke();
    
    // Arms
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - 60, centerY - 80);
    this.ctx.lineTo(centerX, centerY - 100);
    this.ctx.lineTo(centerX + 60, centerY - 80);
    this.ctx.stroke();
    
    // Legs
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY + 50);
    this.ctx.lineTo(centerX - 20, centerY + 120);
    this.ctx.moveTo(centerX, centerY + 50);
    this.ctx.lineTo(centerX + 20, centerY + 120);
    this.ctx.stroke();
    
    // Add "3D" indicator text
    this.ctx.fillStyle = '#666';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Interactive 2D Mannequin (Fallback Mode)', centerX, 30);
    this.ctx.fillText('Click search results to highlight acupoints', centerX, 50);
  }

  highlightAcupoint(acupoint) {
    this.clearHighlights();
    
    if (!acupoint || !acupoint.position) return;
    
    // Convert 3D coordinates to 2D canvas coordinates
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Map 3D coordinates to 2D canvas (simplified projection)
    const canvasX = centerX + (acupoint.position.x * 50);
    const canvasY = centerY - (acupoint.position.y * 50);
    
    this.selectedMarker = {
      x: canvasX,
      y: canvasY,
      acupoint: acupoint,
      pulse: 0
    };
    
    console.log(`Highlighted acupoint: ${acupoint.name_ja} at canvas position (${canvasX}, ${canvasY})`);
  }

  drawHighlights() {
    if (!this.selectedMarker) return;
    
    const marker = this.selectedMarker;
    
    // Animate pulse effect
    marker.pulse += 0.1;
    const pulseScale = 1 + Math.sin(marker.pulse) * 0.3;
    
    // Draw marker circle
    this.ctx.save();
    this.ctx.globalAlpha = 0.8;
    this.ctx.fillStyle = '#FF4444';
    this.ctx.strokeStyle = '#CC0000';
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    this.ctx.arc(marker.x, marker.y, 8 * pulseScale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw label background
    const label = `${marker.acupoint.name_ja}\n${marker.acupoint.name_en}`;
    const lines = label.split('\n');
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(marker.x - 60, marker.y - 50, 120, 40);
    
    // Draw label text
    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    lines.forEach((line, index) => {
      this.ctx.fillText(line, marker.x, marker.y - 35 + (index * 16));
    });
    
    this.ctx.restore();
  }

  clearHighlights() {
    this.selectedMarker = null;
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Simple click interaction - could be expanded
    console.log(`Canvas clicked at (${clickX}, ${clickY})`);
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Recreate mannequin with new dimensions
    this.createMannequin();
  }

  animate() {
    this.drawMannequin();
    this.drawHighlights();
    
    requestAnimationFrame(() => this.animate());
  }

  // Maintain same API as full 3D version
  getScene() {
    return this.canvas;
  }
}

// Export fallback version
window.Scene3DFallback = Scene3DFallback;