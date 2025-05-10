import * as THREE from 'three';

let rayLinesGroup; // A group to hold all line segments
const MAX_RAYS = 50; // Max number of rays to visualize
const rayMaterial = new THREE.LineBasicMaterial({
    color: 0xffaa00, // Bright orange/yellow
    transparent: true,
    opacity: 0.16,
    linewidth: 1, // Note: linewidth > 1 might not work on all systems with WebGL
    depthWrite: false,
    depthTest: false, // Draw on top
});

export function setupRayVisualizer(scene) {
    rayLinesGroup = new THREE.Group();
    scene.add(rayLinesGroup);
    return rayLinesGroup;
}

// Simplified ray visualization:
// For a point on screen (near BH), show a "bent" path from a conceptual background.
// The "bend" happens at the black hole's X,Y plane.
// The "source" is approximated by inverting the lensing formula crudely.
export function updateRayVisuals(params, camera, blackHoleWorldPosition, lensingStrengthParam) {
    if (!rayLinesGroup || !params.showRays) {
        if(rayLinesGroup) rayLinesGroup.children.forEach(child => child.visible = false);
        return;
    }

    rayLinesGroup.children.forEach(child => child.visible = false); // Hide old rays before reusing
    let visibleRayIndex = 0;

    const numRays = Math.min(MAX_RAYS, params.numVisualizedRays);
    const bhScreenPos = getBlackHoleScreenPosition(blackHoleWorldPosition, camera);

    // Define a conceptual background plane distance. Should be far behind the black hole.
    const backgroundPlaneZ = blackHoleWorldPosition.z - params.raySourceDistance;

    for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const screenRadiusFactor = params.rayOriginRadiusFactor; // How far from BH center to start screen points

        // 1. Pick a point on the screen around the black hole's projection
        // This is the point where the lensed light ARRIVES at the observer's "screen"
        const observedScreenX = bhScreenPos.x + Math.cos(angle) * screenRadiusFactor * params.eventHorizonRadius * 50; // scale by EH for screen pixels
        const observedScreenY = bhScreenPos.y + Math.sin(angle) * screenRadiusFactor * params.eventHorizonRadius * 50;

        const ndcObserved = new THREE.Vector2(
            (observedScreenX / window.innerWidth) * 2 - 1,
            -(observedScreenY / window.innerHeight) * 2 + 1
        );

        // This is the direction from camera to the observed point on screen
        const rayToObserver = new THREE.Vector3(ndcObserved.x, ndcObserved.y, -1).unproject(camera);
        rayToObserver.sub(camera.position).normalize();


        // 2. Estimate where this light ray *originated* from on the background
        // This is a gross simplification for visualization. The shader does the real math.
        // We use the screen-space lensing formula to find an approximate "source UV"
        // then map that UV to a world position on our conceptual background plane.

        const bhUv = new THREE.Vector2(bhScreenPos.x / window.innerWidth, 1.0 - bhScreenPos.y / window.innerHeight);
        const observedUv = new THREE.Vector2(observedScreenX / window.innerWidth, 1.0 - observedScreenY / window.innerHeight);
        
        let uv_centered = observedUv.clone().sub(bhUv);
        const aspect = window.innerWidth / window.innerHeight;
        uv_centered.x *= aspect;
        const r2 = uv_centered.lengthSq();

        // Inverse of the shader's primary lensing term to find where it *came from*
        // final_uv_centered = observed_uv_centered * (1 - S/r^2)
        // => observed_uv_centered = final_uv_centered / (1 - S/r^2) -- this is what shader does
        // We want to find source_uv_centered if we know observed_uv_centered.
        // source_uv_centered = observed_uv_centered / (1.0 - lensingStrengthParam / r2);
        // This logic is actually what the shader does: uv_centered is observed, it calcs sample_offset (which is source)
        let source_uv_centered = uv_centered.clone();
        if (r2 > 0.00001 && lensingStrengthParam > 0) { // Avoid division by zero or extreme values
             // The shader formula is: sample_offset_from_bh_center = uv_centered * (1.0 - lensingStrength / r2);
             // This means original_uv = observed_uv - deflection.
             // Deflection = uv_centered * (-lensingStrength / r2)
             // So, source_uv_centered_before_bh_offset = uv_centered * (1.0 + lensingStrength / r2) (approximately, for strong lensing)
             // Or, more simply, the ray arriving at `observedUv` came from `finalUv` in the shader.
             // `finalUv = bhUv + uv_centered_aspect_corrected * (1.0 - lensingStrength / r2_aspect_corrected)`
             // For visualization, let's use the idea that light is bent TOWARDS the mass.
             // So, if we see it at `uv_centered` from the lens, it came from further out.
             const deflectionFactor = lensingStrengthParam / r2; // lensingStrengthParam is R_E_sq screen space
             source_uv_centered.multiplyScalar(1 + deflectionFactor); // Crude approximation: source is further out
        }
        source_uv_centered.x /= aspect; // De-correct aspect
        const sourceUv = bhUv.clone().add(source_uv_centered);


        // 3. Convert source UV to world position on the background plane
        // Assuming background plane is perpendicular to Z axis at backgroundPlaneZ
        // And UVs map to a certain world-space width/height on that plane.
        // Let's make the background plane quite large.
        const backgroundWorldWidth = 200; // Adjust as needed
        const backgroundWorldHeight = 200 / aspect;

        const sourceWorldX = (sourceUv.x - 0.5) * backgroundWorldWidth;
        const sourceWorldY = (sourceUv.y - 0.5) * backgroundWorldHeight;
        const sourcePoint = new THREE.Vector3(sourceWorldX, sourceWorldY, backgroundPlaneZ);


        // 4. Define the "bend point" near the black hole.
        // For simplicity, let this be on the plane of the black hole, along the incoming ray.
        const L = blackHoleWorldPosition.clone().sub(camera.position);
        const tca = L.dot(rayToObserver);
        const pClosest = camera.position.clone().add(rayToObserver.clone().multiplyScalar(tca)); // Closest point on ray to BH center
        const dVec = pClosest.clone().sub(blackHoleWorldPosition); // Vector from BH center to pClosest
        const impactParam = dVec.length();
        
        // A better bend point might be the point of closest approach of the *original* ray
        // to the black hole. This is complex. Let's use a point on the black hole's Z-plane.
        const bendPoint = new THREE.Vector3();
        const planeNormal = new THREE.Vector3(0,0,1);
        const plane = new THREE.Plane(planeNormal, -blackHoleWorldPosition.z);
        const incomingRay = new THREE.Ray(sourcePoint, blackHoleWorldPosition.clone().sub(sourcePoint).normalize());
        incomingRay.intersectPlane(plane, bendPoint);

        if(impactParam < params.eventHorizonRadius * 1.1) { // If ray passes too close, don't draw (it's "absorbed")
             continue;
        }

        // Create or update line segments
        const points = [];
        points.push(sourcePoint.clone());       // Start from "distant source"
        points.push(bendPoint.clone());         // Bend near black hole
        points.push(camera.position.clone());   // End at camera

        if (visibleRayIndex < rayLinesGroup.children.length) {
            const line = rayLinesGroup.children[visibleRayIndex];
            line.geometry.setFromPoints(points);
            line.geometry.computeBoundingSphere(); // Important for frustum culling
            line.visible = true;
        } else {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, rayMaterial);
            rayLinesGroup.add(line);
        }
        visibleRayIndex++;
    }
}

function getBlackHoleScreenPosition(blackHoleWorldPosition, camera) {
    const vector = blackHoleWorldPosition.clone();
    vector.project(camera); // Project world to NDC (-1 to 1)
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
    return { x, y, z: vector.z }; // z is NDC z, can be used for depth check
}

export function updateRayMaterial(params) {
    rayMaterial.opacity = params.rayOpacity;
    rayMaterial.color.setHex(parseInt(params.rayColor.replace("#","0x"),16));
}