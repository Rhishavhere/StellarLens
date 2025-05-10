// js/sceneSetup.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function setupScene(params) {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = params.cameraInitialZ;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 100;

    const bhGeometry = new THREE.SphereGeometry(params.eventHorizonRadius, 32, 32);
    const bhMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.1,
        metalness: 0.2,
        emissive: params.showBlackHoleMesh ? 0x110011 : 0x000000,
        emissiveIntensity: 0.2
    });
    const blackHoleMesh = new THREE.Mesh(bhGeometry, bhMaterial);
    blackHoleMesh.position.set(0, 0, params.blackHoleZ);
    if (params.showBlackHoleMesh) {
        scene.add(blackHoleMesh);
    }

    const pointLight = new THREE.PointLight(0xffddaa, 0.6, 200);
    pointLight.position.copy(blackHoleMesh.position);
    scene.add(pointLight);
    const ambientLight = new THREE.AmbientLight(0x606070, 0.3);
    scene.add(ambientLight);

    // --- REMOVE STAR FIELD ---
    // const starVertices = [];
    // const numStars = 20000;
    // for (let i = 0; i < numStars; i++) {
    //     const x = THREE.MathUtils.randFloatSpread(1000);
    //     const y = THREE.MathUtils.randFloatSpread(1000);
    //     const z = THREE.MathUtils.randFloatSpread(1000);
    //     starVertices.push(x, y, z);
    // }
    // const starGeometry = new THREE.BufferGeometry();
    // starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    // const starMaterial = new THREE.PointsMaterial({
    //     color: 0xffffff,
    //     size: params.starSize, // This param will also be removed from PARAMS
    //     sizeAttenuation: true,
    //     transparent: true,
    //     opacity: 0.8,
    //     depthWrite: false
    // });
    // const starField = new THREE.Points(starGeometry, starMaterial);
    // scene.add(starField);
    // --- END REMOVE STAR FIELD ---

    return { scene, camera, renderer, controls, blackHoleMesh, pointLight /* remove starField, starMaterial */ };
}

export function updateBlackHoleMeshAppearance(blackHoleMesh, params) {
    if (blackHoleMesh) {
        blackHoleMesh.visible = params.showBlackHoleMesh;
        if (params.showBlackHoleMesh) {
            if (blackHoleMesh.geometry.parameters.radius !== params.eventHorizonRadius) {
                 blackHoleMesh.geometry.dispose();
                 blackHoleMesh.geometry = new THREE.SphereGeometry(params.eventHorizonRadius, 32, 32);
            }
        }
    }
}