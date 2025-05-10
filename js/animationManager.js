// js/animationManager.js
import * as THREE from 'three';

export function animateBlackHole(blackHoleMesh, pointLight, clock, params) {
    if (!params.animateBlackHole || !blackHoleMesh) return;

    const elapsedTime = clock.getElapsedTime();
    const originalZ = params.blackHoleZ;

    blackHoleMesh.position.x = Math.sin(elapsedTime * params.bhAnimationSpeed) * params.bhAnimationRadius;
    blackHoleMesh.position.y = Math.cos(elapsedTime * params.bhAnimationSpeed * 0.7) * params.bhAnimationRadius * 0.6;
    blackHoleMesh.position.z = originalZ;

    if (pointLight) {
        pointLight.position.copy(blackHoleMesh.position);
    }
}

// --- REMOVE STAR FIELD ANIMATION ---
// export function animateStarField(starField, clock, params) {
//     if (!starField || !params.animateStarField) return;
//     starField.rotation.y = clock.getElapsedTime() * params.starAnimationSpeed;
//     starField.rotation.x = clock.getElapsedTime() * params.starAnimationSpeed * 0.3;
// }
// --- END REMOVE STAR FIELD ANIMATION ---