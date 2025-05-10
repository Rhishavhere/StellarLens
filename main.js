import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // If you want a 3D BH model
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


let scene, camera, renderer, controls;
let lensingMaterial, lensingQuad;
let backgroundTexture;
let blackHoleMesh; // A simple sphere to represent the black hole's position visually
let composer;

const params = {
    lensingStrength: 0.002, // This will be R_E^2 in the shader's screen-space formula
    eventHorizonRadius: 0.5, // World units
    blackHoleZ: -10,
    bloomStrength: 0.4,
    bloomRadius: 0.5,
    bloomThreshold: 0.7
};

async function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Load background texture (galaxy/stars)
    const textureLoader = new THREE.TextureLoader();
    backgroundTexture = await textureLoader.loadAsync('textures/galaxy.jpg'); // Replace with your texture
    backgroundTexture.wrapS = THREE.ClampToEdgeWrapping; // Or MirroredRepeatWrapping
    backgroundTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Black Hole Visualizer (simple sphere)
    // This mesh is just a visual aid in 3D space, not directly involved in lensing shader's core logic
    // other than providing its world position.
    const bhGeometry = new THREE.SphereGeometry(params.eventHorizonRadius, 32, 32);
    const bhMaterial = new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: false }); // Dark, non-emissive
    blackHoleMesh = new THREE.Mesh(bhGeometry, bhMaterial);
    blackHoleMesh.position.set(0, 0, params.blackHoleZ);
    scene.add(blackHoleMesh); // Add to scene to see it if not obscured by lensing quad

    // Lensing Shader Material
    const vertexShader = await fetch('shaders/lensing.vert').then(res => res.text());
    const fragmentShader = await fetch('shaders/lensing.frag').then(res => res.text());

    lensingMaterial = new THREE.ShaderMaterial({
        uniforms: {
            backgroundTexture: { value: backgroundTexture },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            blackHoleWorldPosition: { value: blackHoleMesh.position },
            lensingStrength: { value: params.lensingStrength },
            eventHorizonRadius: { value: params.eventHorizonRadius }, // World space radius
            viewMatrixInverse: { value: camera.matrixWorld },
            projectionMatrixInverse: { value: camera.projectionMatrixInverse },
            cameraWorldPosition: { value: camera.position }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true // Allows seeing 3D objects behind if needed (e.g. BH mesh)
                          // but our shader draws the BH silhouette, so it's okay.
    });

    // Full-screen quad for lensing effect
    // This quad will cover the entire screen and apply the lensing shader.
    // It should be rendered last, or in a separate pass.
    const lensingGeometry = new THREE.PlaneGeometry(2, 2); // Covers NDC space
    lensingQuad = new THREE.Mesh(lensingGeometry, lensingMaterial);
    // We will render this quad in a separate scene or ensure it's drawn on top.
    // For now, just add to main scene. It might obscure the BH sphere.
    // A common way is to render the 3D scene, then render this quad with an ortho camera.
    // Or, use EffectComposer. For simplicity, let's add it to the main scene.
    // To ensure it's visible "in front", we can make it part of a HUD scene or
    // simply add it to the main scene. Since it's a full screen effect, its Z doesn't matter much.
    scene.add(lensingQuad);


    // Post-processing for "stunning visuals" (Bloom)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = params.bloomThreshold;
    bloomPass.strength = params.bloomStrength;
    bloomPass.radius = params.bloomRadius;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    // The lensing quad should be rendered by the renderScene pass.
    // Bloom will apply to the result of that.
    composer.addPass(bloomPass);


    // GUI
    const gui = new GUI();
    gui.add(params, 'lensingStrength', 0.0001, 0.05, 0.0001).name('Lensing Strength').onChange(updateUniforms);
    gui.add(params, 'eventHorizonRadius', 0.1, 2.0, 0.01).name('BH Radius (World)').onChange(val => {
        blackHoleMesh.geometry.dispose();
        blackHoleMesh.geometry = new THREE.SphereGeometry(val, 32, 32);
        updateUniforms();
    });
    gui.add(params, 'blackHoleZ', -50, -1, 0.1).name('BH Z Position').onChange(val => {
        blackHoleMesh.position.z = val;
        updateUniforms();
    });
    const bloomFolder = gui.addFolder('Bloom Effect');
    bloomFolder.add(params, 'bloomStrength', 0.0, 3.0).name('Strength').onChange(val => bloomPass.strength = val);
    bloomFolder.add(params, 'bloomRadius', 0.0, 1.0).name('Radius').onChange(val => bloomPass.radius = val);
    bloomFolder.add(params, 'bloomThreshold', 0.0, 1.0).name('Threshold').onChange(val => bloomPass.threshold = val);


    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    updateUniforms(); // Initial uniform update
    animate();
}

function updateUniforms() {
    if (lensingMaterial) {
        lensingMaterial.uniforms.lensingStrength.value = params.lensingStrength;
        lensingMaterial.uniforms.eventHorizonRadius.value = params.eventHorizonRadius;
        lensingMaterial.uniforms.blackHoleWorldPosition.value.copy(blackHoleMesh.position);

        // Camera matrices need to be updated each frame as camera moves
        camera.updateMatrixWorld(); // Ensure camera.matrixWorld is up to date
        camera.updateProjectionMatrix(); // Ensure camera.projectionMatrix is up to date
        
        lensingMaterial.uniforms.viewMatrixInverse.value.copy(camera.matrixWorld);
        lensingMaterial.uniforms.projectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
        lensingMaterial.uniforms.cameraWorldPosition.value.copy(camera.position);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight); // Resize composer
    if (lensingMaterial) {
        lensingMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateUniforms(); // Update uniforms, especially camera matrices

    // The blackHoleMesh is part of the main scene.
    // The lensingQuad is also part of the main scene and will be drawn by the RenderPass.
    // The lensing shader on lensingQuad will effectively "replace" the background.
    
    // Hide the actual black hole mesh if it's behind the lensing plane,
    // or ensure the lensing quad is rendered "on top".
    // The shader should draw the black hole silhouette, so the 3D mesh is mostly a helper.
    // If lensingQuad covers screen, it will obscure blackHoleMesh unless transparent parts or depth logic.
    // Our lensing shader is opaque where event horizon is.
    // We can move lensingQuad slightly closer to camera to ensure it's "in front" if needed,
    // or handle render order.
    // A simple way: render the main scene without the quad, then render the quad.
    // But with EffectComposer, RenderPass handles the main scene.
    // The current setup should work: scene contains BH mesh and lensing quad.
    // The lensing quad's shader computes everything.

    composer.render(); // Use composer for rendering
    // renderer.render(scene, camera); // If not using composer
}

init().catch(err => console.error("Initialization failed:", err));