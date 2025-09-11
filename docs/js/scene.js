/**
 * Three.js Scene Management for Acupuncture 3D Visualization
 * 
 * This module handles the 3D scene creation, camera controls, and simple mannequin generation.
 * Future enhancement: Replace simple geometry with detailed GLTF human model.
 */

class Scene3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.modelGroup = null;
    this.acupointMarkers = new THREE.Group();
    this.selectedMarker = null;
    
    this.init();
    this.createMannequin();
    this.animate();
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    
    // Camera setup
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(3, 2, 5);
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    
    // Controls setup - Import OrbitControls from CDN
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI;
    
    // Lighting setup
    this.setupLighting();
    
    // Add acupoint markers group to scene
    this.scene.add(this.acupointMarkers);
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    this.scene.add(directionalLight);
    
    // Fill light
    const fillLight = new THREE.DirectionalLight(0x9090aa, 0.3);
    fillLight.position.set(-10, 5, -5);
    this.scene.add(fillLight);
  }

  /**
   * Create a simple mannequin using primitive geometry
   * TODO: Replace with detailed GLTF human model for production
   */
  createMannequin() {
    this.modelGroup = new THREE.Group();
    
    // Head (sphere)
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xfdbcb4,
      shininess: 30
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 2.5, 0);
    head.castShadow = true;
    this.modelGroup.add(head);
    
    // Torso (capsule-like cylinder)
    const torsoGeometry = new THREE.CylinderGeometry(0.6, 0.5, 2, 12);
    const torsoMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xfdbcb4,
      shininess: 30
    });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.set(0, 1, 0);
    torso.castShadow = true;
    this.modelGroup.add(torso);
    
    // Arms (cylinders)
    const armGeometry = new THREE.CylinderGeometry(0.15, 0.12, 1.5, 8);
    const armMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xfdbcb4,
      shininess: 30
    });
    
    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-1.2, 1.2, 0);
    leftArm.rotation.z = Math.PI / 6;
    leftArm.castShadow = true;
    this.modelGroup.add(leftArm);
    
    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(1.2, 1.2, 0);
    rightArm.rotation.z = -Math.PI / 6;
    rightArm.castShadow = true;
    this.modelGroup.add(rightArm);
    
    // Legs (cylinders)
    const legGeometry = new THREE.CylinderGeometry(0.18, 0.15, 2, 8);
    const legMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xfdbcb4,
      shininess: 30
    });
    
    // Left leg
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.3, -1.5, 0);
    leftLeg.castShadow = true;
    this.modelGroup.add(leftLeg);
    
    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.3, -1.5, 0);
    rightLeg.castShadow = true;
    this.modelGroup.add(rightLeg);
    
    // Ground plane for shadows
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xcccccc,
      transparent: true,
      opacity: 0.3
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.5;
    ground.receiveShadow = true;
    this.modelGroup.add(ground);
    
    this.scene.add(this.modelGroup);
  }

  /**
   * Highlight an acupoint by creating a marker at the specified position
   */
  highlightAcupoint(acupoint) {
    // Clear previous markers
    this.clearHighlights();
    
    if (!acupoint || !acupoint.position) return;
    
    // Create marker sphere
    const markerGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff4444,
      emissive: 0x442222
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(acupoint.position.x, acupoint.position.y, acupoint.position.z);
    
    // Create label sprite
    const label = this.createTextSprite(acupoint.name_ja + '\n' + acupoint.name_en);
    label.position.set(
      acupoint.position.x,
      acupoint.position.y + 0.3,
      acupoint.position.z
    );
    
    // Add pulsing animation to marker
    const pulseScale = { scale: 1 };
    const animate = () => {
      pulseScale.scale += 0.02;
      if (pulseScale.scale > 1.3) pulseScale.scale = 1;
      marker.scale.setScalar(pulseScale.scale);
      if (this.selectedMarker === marker) {
        requestAnimationFrame(animate);
      }
    };
    animate();
    
    this.acupointMarkers.add(marker);
    this.acupointMarkers.add(label);
    this.selectedMarker = marker;
    
    // Focus camera on the acupoint
    this.focusOnPoint(acupoint.position);
  }

  /**
   * Create a text sprite for labeling acupoints
   */
  createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    
    canvas.width = Math.max(textWidth + 20, 150);
    canvas.height = 80;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = 'white';
    context.font = '14px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, canvas.height / 2 + (index - 0.5) * 16);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      alphaTest: 0.5
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1, 0.5, 1);
    
    return sprite;
  }

  /**
   * Clear all acupoint highlights
   */
  clearHighlights() {
    this.acupointMarkers.clear();
    this.selectedMarker = null;
  }

  /**
   * Smoothly focus camera on a specific point
   */
  focusOnPoint(position) {
    // Calculate ideal camera position
    const targetPosition = new THREE.Vector3(
      position.x + 2,
      position.y + 1,
      position.z + 2
    );
    
    // Smooth camera transition (simple version)
    // TODO: Add smooth animation using Tween.js or similar
    this.camera.position.copy(targetPosition);
    this.controls.target.copy(new THREE.Vector3(position.x, position.y, position.z));
    this.controls.update();
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  /**
   * Animation loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Get the 3D scene for external access if needed
   */
  getScene() {
    return this.scene;
  }
}

// Export for use in app.js
window.Scene3D = Scene3D;