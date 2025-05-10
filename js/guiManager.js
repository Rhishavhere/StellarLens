// js/guiManager.js
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { updateBlackHoleMeshAppearance } from './sceneSetup.js';
import { updateRayMaterial } from './rayVisualizer.js';

export function setupGUI(params, blackHoleMeshRef) {
    const gui = new GUI({ container: document.getElementById('gui-container') });

    const lensingFolder = gui.addFolder('Lensing Parameters');
    lensingFolder.add(params, 'lensingStrength', 0.00001, 0.1, 0.00001).name('Lensing Strength (R<sub>E</sub><sup>2</sup>)');
    lensingFolder.add(params, 'eventHorizonRadius', 0.01, 5.0, 0.01).name('BH Radius (World)')
        .onChange(() => updateBlackHoleMeshAppearance(blackHoleMeshRef, params));
    lensingFolder.add(params, 'blackHoleZ', -200, -1, 0.1).name('BH Z Position')
        .onChange(val => {
            if(blackHoleMeshRef) blackHoleMeshRef.position.z = val;
        });

    const appearanceFolder = gui.addFolder('Appearance');
    appearanceFolder.add(params, 'showBlackHoleMesh').name('Show BH 3D Mesh')
        .onChange(() => updateBlackHoleMeshAppearance(blackHoleMeshRef, params));
    // --- REMOVE STAR SIZE GUI ---
    // appearanceFolder.add(params, 'starSize', 0.01, 0.5, 0.005).name('Star Size');
    // --- END REMOVE STAR SIZE GUI ---

    const animFolder = gui.addFolder('Animations');
    animFolder.add(params, 'animateBlackHole').name('Animate Black Hole');
    animFolder.add(params, 'bhAnimationSpeed', 0.01, 1.0, 0.01).name('BH Anim Speed');
    animFolder.add(params, 'bhAnimationRadius', 0.1, 10.0, 0.1).name('BH Anim Radius');
    animFolder.add(params, 'animateBackground').name('Animate Background');
    // --- REMOVE STAR ANIMATION GUI ---
    // animFolder.add(params, 'animateStarField').name('Animate Star Field');
    // animFolder.add(params, 'starAnimationSpeed', 0.001, 0.1, 0.001).name('Star Anim Speed');
    // --- END REMOVE STAR ANIMATION GUI ---

    const rayFolder = gui.addFolder('Ray Visualization');
    rayFolder.add(params, 'showRays').name('Show Rays');
    rayFolder.add(params, 'numVisualizedRays', 1, MAX_RAYS, 1).name('Number of Rays');
    rayFolder.add(params, 'rayOriginRadiusFactor', 0.5, 5.0, 0.1).name('Ray Origin Radius Factor');
    rayFolder.add(params, 'raySourceDistance', 10, 500, 1).name('Ray Source Distance');
    rayFolder.addColor(params, 'rayColor').name('Ray Color').onChange(() => updateRayMaterial(params));
    rayFolder.add(params, 'rayOpacity', 0.05, 1.0, 0.01).name('Ray Opacity').onChange(() => updateRayMaterial(params));

    const postProcessingFolder = gui.addFolder('Post-Processing (Bloom)');
    postProcessingFolder.add(params, 'bloomStrength', 0.0, 3.0).name('Strength');
    postProcessingFolder.add(params, 'bloomRadius', 0.0, 2.0).name('Radius');
    postProcessingFolder.add(params, 'bloomThreshold', 0.0, 1.0).name('Threshold');

    const infoPanelFolder = gui.addFolder('Info Panel');
    infoPanelFolder.add(params, 'showInfoPanel').name('Show Info Panel');

    return gui;
}

const MAX_RAYS = 50;