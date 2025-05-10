import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// GLTFLoader not used in this simplified version, can remove if not adding 3D model for BH
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let scene, camera, renderer, controls;
let lensingMaterial, lensingQuad;
let backgroundTexture;
let blackHoleMesh; // Visual aid for BH position
let composer;
let clock = new THREE.Clock(); // For animation time
let starField;

const params = {
    lensingStrength: 0.002,
    eventHorizonRadius: 0.5,
    blackHoleZ: -10,
    bhAnimationSpeed: 0.2,
    bhAnimationRadius: 1.5,
    bloomStrength: 0.4,
    bloomRadius: 0.5,
    bloomThreshold: 0.7,
    animateBlackHole: true,
    animateBackground: true,
};

async function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 7; // Slightly further back

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 50;

    const textureLoader = new THREE.TextureLoader();
    backgroundTexture = await textureLoader.loadAsync('textures/galaxy.jpg');
    backgroundTexture.wrapS = THREE.RepeatWrapping; // Changed to RepeatWrapping for seamless animation
    backgroundTexture.wrapT = THREE.RepeatWrapping; // Changed to RepeatWrapping

    const bhGeometry = new THREE.SphereGeometry(params.eventHorizonRadius, 32, 32);
    // A slightly more "sci-fi" material for the black hole sphere itself
    const bhMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.1,
        metalness: 0.2,
        emissive: 0x110011, // Faint ominous glow
        emissiveIntensity: 0.2
    });
    blackHoleMesh = new THREE.Mesh(bhGeometry, bhMaterial);
    blackHoleMesh.position.set(0, 0, params.blackHoleZ);
    scene.add(blackHoleMesh);

    // Add a subtle point light near the black hole, as if from accretion disk
    const pointLight = new THREE.PointLight(0xffaa55, 0.5, 100); // Soft orange
    pointLight.position.set(0,0, params.blackHoleZ); // Position it with the black hole
    scene.add(pointLight);
    const ambientLight = new THREE.AmbientLight(0x404040, 0.2); // Faint ambient
    scene.add(ambientLight);


    // --- Create Star Field ---
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = THREE.MathUtils.randFloatSpread(200); // Spread them out
        const y = THREE.MathUtils.randFloatSpread(200);
        const z = THREE.MathUtils.randFloatSpread(200);
        starVertices.push(x, y, z);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.05, // Adjust size
        sizeAttenuation: true, // Smaller further away
        transparent: true,
        opacity: 0.7
    });
    starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField); // Add stars to the main scene

    // Lensing Shader Material
    const vertexShader = await fetch('shaders/lensing.vert').then(res => res.text());
    const fragmentShader = await fetch('shaders/lensing.frag').then(res => res.text());

    lensingMaterial = new THREE.ShaderMaterial({
        uniforms: {
            backgroundTexture: { value: backgroundTexture },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            time: { value: 0.0 }, // Add time uniform
            blackHoleWorldPosition: { value: blackHoleMesh.position },
            lensingStrength: { value: params.lensingStrength },
            eventHorizonRadius: { value: params.eventHorizonRadius },
            viewMatrixInverse: { value: camera.matrixWorld },
            projectionMatrixInverse: { value: camera.projectionMatrixInverse },
            cameraWorldPosition: { value: camera.position }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: false // The shader handles transparency (black for event horizon)
    });

    const lensingGeometry = new THREE.PlaneGeometry(2, 2);
    lensingQuad = new THREE.Mesh(lensingGeometry, lensingMaterial);
    scene.add(lensingQuad); // Add to main scene, will be part of RenderPass

    // Post-processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = params.bloomThreshold;
    bloomPass.strength = params.bloomStrength;
    bloomPass.radius = params.bloomRadius;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // GUI
    const gui = new GUI();
    gui.add(params, 'lensingStrength', 0.0001, 0.05, 0.0001).name('Lensing Strength').onChange(updateUniforms);
    gui.add(params, 'eventHorizonRadius', 0.1, 3.0, 0.01).name('BH Radius (World)').onChange(val => {
        blackHoleMesh.geometry.dispose();
        blackHoleMesh.geometry = new THREE.SphereGeometry(val, 32, 32);
        updateUniforms();
    });
    gui.add(params, 'blackHoleZ', -50, -1, 0.1).name('BH Z Position').onChange(val => {
        blackHoleMesh.position.z = val;
        pointLight.position.z = val; // Move light with BH
        updateUniforms();
    });

    const animFolder = gui.addFolder('Animations');
    animFolder.add(params, 'animateBlackHole').name('Animate Black Hole');
    animFolder.add(params, 'bhAnimationSpeed', 0.01, 1.0, 0.01).name('BH Anim Speed');
    animFolder.add(params, 'bhAnimationRadius', 0.1, 5.0, 0.1).name('BH Anim Radius');
    animFolder.add(params, 'animateBackground').name('Animate Background');


    const bloomFolder = gui.addFolder('Bloom Effect');
    bloomFolder.add(params, 'bloomStrength', 0.0, 3.0).name('Strength').onChange(val => bloomPass.strength = val);
    bloomFolder.add(params, 'bloomRadius', 0.0, 1.0).name('Radius').onChange(val => bloomPass.radius = val);
    bloomFolder.add(params, 'bloomThreshold', 0.0, 1.0).name('Threshold').onChange(val => bloomPass.threshold = val);

    window.addEventListener('resize', onWindowResize, false);
    updateUniforms();
    animate();
}

function updateUniforms() {
    if (lensingMaterial) {
        const elapsedTime = clock.getElapsedTime();
        lensingMaterial.uniforms.time.value = params.animateBackground ? elapsedTime : 0.0;
        lensingMaterial.uniforms.lensingStrength.value = params.lensingStrength;
        lensingMaterial.uniforms.eventHorizonRadius.value = params.eventHorizonRadius;
        lensingMaterial.uniforms.blackHoleWorldPosition.value.copy(blackHoleMesh.position);

        camera.updateMatrixWorld(true); // Force update
        lensingMaterial.uniforms.viewMatrixInverse.value.copy(camera.matrixWorld);
        lensingMaterial.uniforms.projectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
        lensingMaterial.uniforms.cameraWorldPosition.value.copy(camera.getWorldPosition(new THREE.Vector3()));
    }
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

function animateBlackHole() {
    if (!params.animateBlackHole) return;
    const elapsedTime = clock.getElapsedTime();
    blackHoleMesh.position.x = Math.sin(elapsedTime * params.bhAnimationSpeed) * params.bhAnimationRadius;
    blackHoleMesh.position.y = Math.cos(elapsedTime * params.bhAnimationSpeed * 0.7) * params.bhAnimationRadius * 0.6; // Slightly different speed/radius for Y

    // Keep light with BH
    // pointLight.position.copy(blackHoleMesh.position);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta(); // Get time delta if needed for other animations

    animateBlackHole(); // Animate BH position

    controls.update(); // OrbitControls
    updateUniforms(); // Update shader uniforms

    // Optional: Animate stars (e.g., slow rotation)
    // starField.rotation.y += 0.0001;

    composer.render();
}

init().catch(err => console.error("Initialization failed:", err));