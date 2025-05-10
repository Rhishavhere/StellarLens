// js/lensingEffect.js
import * as THREE from 'three';

let backgroundTexture;
let lensingMaterial;
let lensingQuad;

export async function setupLensingEffect(scene, params, cameraRef) {
    const textureLoader = new THREE.TextureLoader();
    try {
        backgroundTexture = await textureLoader.loadAsync(params.galaxyTexturePath);
        backgroundTexture.wrapS = THREE.RepeatWrapping;
        backgroundTexture.wrapT = THREE.RepeatWrapping;
    } catch (error) {
        console.error("Failed to load background texture:", error);
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const context = canvas.getContext('2d');
        context.fillStyle = 'grey'; context.fillRect(0, 0, 256, 256);
        context.fillStyle = 'white'; context.font = '12px Arial';
        context.fillText('Error loading texture', 10, 128);
        backgroundTexture = new THREE.CanvasTexture(canvas);
    }

    const vertexShader = await fetch('shaders/lensing.vert').then(res => res.text());
    const fragmentShader = await fetch('shaders/lensing.frag').then(res => res.text());

    lensingMaterial = new THREE.ShaderMaterial({
        uniforms: {
            backgroundTexture: { value: backgroundTexture },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            time: { value: 0.0 },
            backgroundBrightness: { value: params.backgroundBrightness }, // Add new uniform
            blackHoleWorldPosition: { value: new THREE.Vector3(0, 0, params.blackHoleZ) },
            lensingStrength: { value: params.lensingStrength },
            eventHorizonRadius: { value: params.eventHorizonRadius },
            viewMatrixInverse: { value: cameraRef.matrixWorld.clone() },
            projectionMatrixInverse: { value: cameraRef.projectionMatrixInverse.clone() },
            cameraWorldPosition: { value: cameraRef.position.clone() }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        depthWrite: false,
        depthTest: false,
    });

    const lensingGeometry = new THREE.PlaneGeometry(2, 2);
    lensingQuad = new THREE.Mesh(lensingGeometry, lensingMaterial);
    scene.add(lensingQuad);

    return { lensingMaterial, lensingQuad };
}

export function updateLensingUniforms(lensingMaterial, params, blackHoleWorldPosition, camera, time) {
    if (!lensingMaterial) return;

    lensingMaterial.uniforms.time.value = params.animateBackground ? time : 0.0;
    lensingMaterial.uniforms.backgroundBrightness.value = params.backgroundBrightness; // Update uniform
    lensingMaterial.uniforms.lensingStrength.value = params.lensingStrength;
    lensingMaterial.uniforms.eventHorizonRadius.value = params.eventHorizonRadius;
    lensingMaterial.uniforms.blackHoleWorldPosition.value.copy(blackHoleWorldPosition);

    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    lensingMaterial.uniforms.viewMatrixInverse.value.copy(camera.matrixWorld);
    lensingMaterial.uniforms.projectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
    lensingMaterial.uniforms.cameraWorldPosition.value.copy(camera.getWorldPosition(new THREE.Vector3()));
    lensingMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
}