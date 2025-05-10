// js/main.js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { setupScene, updateBlackHoleMeshAppearance } from './sceneSetup.js';
import { setupLensingEffect, updateLensingUniforms } from './lensingEffect.js';
import { setupRayVisualizer, updateRayVisuals, updateRayMaterial } from './rayVisualizer.js';
import { setupInfoDisplay, updateInfoPanel } from './infoDisplay.js';
// --- REMOVE STAR ANIMATION IMPORT ---
// import { animateBlackHole, animateStarField } from './animationManager.js';
import { animateBlackHole } from './animationManager.js'; // Keep animateBlackHole
// --- END REMOVE STAR ANIMATION IMPORT ---
import { setupGUI } from './guiManager.js';

// --- Global Parameters ---
const PARAMS = {
    lensingStrength: 0.03334,
    eventHorizonRadius: 1.69,
    blackHoleZ: -15,
    cameraInitialZ: 10,
    galaxyTexturePath: 'textures/galaxy.jpg',
    backgroundBrightness: 1,

    // Animation
    animateBlackHole: true,
    bhAnimationSpeed: 0.1,
    bhAnimationRadius: 2.0,
    animateBackground: true,
    // --- REMOVE STAR PARAMS ---
    // animateStarField: true,
    // starAnimationSpeed: 0.005,
    // starSize: 0.07,
    // --- END REMOVE STAR PARAMS ---

    // Ray Visualization
    showRays: false,
    numVisualizedRays: 20,
    rayOriginRadiusFactor: 1.5,
    raySourceDistance: 300,
    rayColor: '#ffaa00',
    rayOpacity: 0.16,

    // Appearance / Debug
    showBlackHoleMesh: false,
    showInfoPanel: true,

    // Post-processing
    bloomStrength: 0.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
};

// --- Global State ---
let scene, camera, renderer, controls;
// --- REMOVE STAR VARIABLES ---
// let blackHoleMesh, pointLight, starField, starMaterial;
let blackHoleMesh, pointLight; // Keep blackHoleMesh, pointLight
// --- END REMOVE STAR VARIABLES ---
let lensingMaterial, lensingQuad;
let rayLinesGroup;
let infoPanelElement;
let composer;
let bloomPass;
let clock = new THREE.Clock();
let gui;
let lastFrameTime = 0;
let fps = 0;

async function init() {
    // 1. Scene Setup
    const sceneElements = setupScene(PARAMS);
    scene = sceneElements.scene;
    camera = sceneElements.camera;
    renderer = sceneElements.renderer;
    controls = sceneElements.controls;
    blackHoleMesh = sceneElements.blackHoleMesh;
    pointLight = sceneElements.pointLight;
    // --- REMOVE STAR VARIABLES INITIALIZATION ---
    // starField = sceneElements.starField;
    // starMaterial = sceneElements.starMaterial;
    // --- END REMOVE STAR VARIABLES INITIALIZATION ---

    // 2. Lensing Effect
    const lensingElements = await setupLensingEffect(scene, PARAMS, camera);
    lensingMaterial = lensingElements.lensingMaterial;
    lensingQuad = lensingElements.lensingQuad;

    // 3. Ray Visualizer
    rayLinesGroup = setupRayVisualizer(scene);
    updateRayMaterial(PARAMS);

    // 4. Info Display
    infoPanelElement = setupInfoDisplay();

    // 5. Post-processing
    const renderScene = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight),
        PARAMS.bloomStrength, PARAMS.bloomRadius, PARAMS.bloomThreshold);
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // 6. GUI
    gui = setupGUI(PARAMS, blackHoleMesh);

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);

    updateBlackHoleMeshAppearance(blackHoleMesh, PARAMS);

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    if (lensingMaterial) {
        lensingMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
}

function updateGameLogic(elapsedTime, deltaTime) {
    animateBlackHole(blackHoleMesh, pointLight, clock, PARAMS);
    // --- REMOVE STAR FIELD ANIMATION CALL ---
    // animateStarField(starField, clock, PARAMS);
    // --- END REMOVE STAR FIELD ANIMATION CALL ---

    // --- REMOVE STAR MATERIAL UPDATE ---
    // if (starMaterial) starMaterial.size = PARAMS.starSize;
    // --- END REMOVE STAR MATERIAL UPDATE ---

    updateLensingUniforms(lensingMaterial, PARAMS, blackHoleMesh.position, camera, elapsedTime);

    if (PARAMS.showRays && rayLinesGroup) {
        updateRayVisuals(PARAMS, camera, blackHoleMesh.position, PARAMS.lensingStrength);
    } else if (rayLinesGroup) {
        rayLinesGroup.children.forEach(child => child.visible = false);
    }

    if (bloomPass) {
        bloomPass.strength = PARAMS.bloomStrength;
        bloomPass.radius = PARAMS.bloomRadius;
        bloomPass.threshold = PARAMS.bloomThreshold;
    }
}

function render() {
    composer.render();
}

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - lastFrameTime;
    lastFrameTime = elapsedTime;
    if (deltaTime > 0) { // Avoid division by zero if deltaTime is 0
        fps = 1 / deltaTime;
    }


    controls.update();
    updateGameLogic(elapsedTime, deltaTime);
    render();

    if (infoPanelElement) {
        updateInfoPanel(infoPanelElement, PARAMS, blackHoleMesh.position, camera.position, fps);
    }
}

init().catch(err => {
    console.error("Initialization failed:", err);
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'absolute';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.color = 'red';
    errorDiv.style.backgroundColor = 'black';
    errorDiv.style.padding = '20px';
    errorDiv.style.zIndex = '1000';
    errorDiv.innerText = 'Initialization Error: ' + err.message + '\nCheck console for details.';
    document.body.appendChild(errorDiv);
});