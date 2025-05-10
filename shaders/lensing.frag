varying vec2 vUv; // Screen UV coordinates (0 to 1)

uniform sampler2D backgroundTexture; // The galaxy/stars to be lensed
uniform vec2 resolution;             // Screen resolution (width, height)

// Black Hole properties (passed from JavaScript)
uniform vec3 blackHoleWorldPosition;  // World position of the black hole
uniform float lensingStrength;        // Controls how much light bends (proportional to mass)
uniform float eventHorizonRadius;     // World-space radius of the event horizon
                                      // Light rays passing closer than this are "absorbed"

// Camera properties (passed from JavaScript)
uniform mat4 viewMatrixInverse;       // Inverse of camera's view matrix (camera.matrixWorld)
uniform mat4 projectionMatrixInverse; // Inverse of camera's projection matrix
uniform vec3 cameraWorldPosition;

// Function to unproject screen UV to a world space ray direction
vec3 getRayDirection(vec2 screenUv, vec3 camPos, mat4 projInv, mat4 viewInv) {
    vec2 ndc = screenUv * 2.0 - 1.0; // Convert UV to Normalized Device Coords (-1 to 1)
    vec4 rayClip = vec4(ndc.x, ndc.y, -1.0, 1.0); // Point on near plane in clip space

    vec4 rayEye = projInv * rayClip; // To eye/camera space
    rayEye.xyz /= rayEye.w; // Perspective divide

    vec3 worldDir = (viewInv * vec4(rayEye.xyz, 0.0)).xyz; // To world space direction
    return normalize(worldDir);
}


void main() {
    // 1. Calculate the world space view ray for this fragment
    vec3 rayDir = getRayDirection(vUv, cameraWorldPosition, projectionMatrixInverse, viewMatrixInverse);
    vec3 rayOrigin = cameraWorldPosition;

    // 2. Intersection of the ray with the "plane" of the black hole
    // Vector from camera to black hole
    vec3 L = blackHoleWorldPosition - rayOrigin;
    // Project L onto rayDir to find distance along ray to closest approach point to BH
    float tca = dot(L, rayDir);

    // If black hole is behind camera, or too far, don't apply lensing effects strongly (or at all)
    if (tca < 0.0) {
        // For rays not passing "through" the lensing region, sample background normally
        // This requires a proper way to map rayDir to background texture UVs (e.g. equirectangular)
        // For simplicity, we'll just use vUv for now, but this isn't physically correct for non-lensed rays.
        // A better way for non-lensed would be:
        // vec2 equirectUv = vec2(atan(rayDir.x, rayDir.z) / (2.0 * PI) + 0.5, asin(rayDir.y) / PI + 0.5);
        // gl_FragColor = texture2D(backgroundTexture, equirectUv);
        // For now, this demo will assume the background texture is a simple 2D plane and vUv mapping is okay for far field.
        gl_FragColor = texture2D(backgroundTexture, vUv);
        return;
    }

    // Distance squared from black hole center to the ray at its closest approach
    float d2 = dot(L, L) - tca * tca;
    float d = sqrt(d2); // This is the impact parameter 'b'

    // 3. Check if ray hits the event horizon (black hole silhouette)
    if (d < eventHorizonRadius) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black
        return;
    }

    // 4. Calculate deflection
    // We are looking from the camera. The light ray reaching us was bent.
    // The *original* unbent ray came from a direction *further away* from the black hole's projection.
    // The deflection angle alpha = lensingStrength / d (simplified).
    // The effect is that the background appears shifted.
    
    // Project black hole onto the screen to find its UV position
    // This helps define the "center" of lensing on the screen.
    // Note: This is a simplified screen-space approach for deflection direction.
    // A more physically accurate way would involve deflecting rayDir in 3D.
    mat4 viewMatrix = inverse(viewMatrixInverse);
    mat4 projectionMatrix = inverse(projectionMatrixInverse);
    vec4 bhClipPos = projectionMatrix * viewMatrix * vec4(blackHoleWorldPosition, 1.0);
    vec2 bhNdc = bhClipPos.xy / bhClipPos.w;
    vec2 bhUv = bhNdc * 0.5 + 0.5; // Black hole center in screen UV space

    // Vector on screen from black hole center to current pixel
    vec2 toPixel = vUv - bhUv;
    
    // Aspect ratio correction for screen space calculations
    float aspect = resolution.x / resolution.y;
    toPixel.x *= aspect;

    float distScreenSq = dot(toPixel, toPixel);
    if (distScreenSq == 0.0) { // Avoid division by zero at the exact center
        gl_FragColor = texture2D(backgroundTexture, vUv); // Or handle as needed
        return;
    }
    
    // This is the core lensing formula for point mass (Einstein ring / multiple images)
    // beta = theta - M/theta (where M is related to Einstein radius squared)
    // theta is angular separation from lens, beta is angular separation of source
    // Here, 'toPixel' is like theta, 'lensingStrengthScaled' is like M.
    // 'lensingStrength' needs to be scaled because 'd' (impact param) is world units,
    // but here we are using screen-space 'toPixel' for deflection direction.
    // A good heuristic: lensingStrengthScaled = lensingStrength / (distance_to_bh * some_factor)
    // Let's use a `lensingStrengthScaled` uniform for simplicity of tuning.
    // float deflectionMagnitude = lensingStrength / d; // This is an angle.
    // We need to convert this angular deflection to a UV offset.
    
    // Using the typical screen-space formula directly for strong lensing:
    // `offset_vector = ( lensing_strength_param / screen_distance_sq ) * vector_to_pixel`
    // `source_uv = current_uv - offset_vector` (light comes from further out)
    // A common form for Einstein rings:
    // `uv_source_centered = uv_pixel_centered * (1.0 - R_E_sq / dist_pixel_centered_sq)`
    // where R_E_sq is Einstein radius squared (our lensingStrength).
    
    vec2 uv_centered = vUv - bhUv; // Vector from BH center to pixel, in UV space
    uv_centered.x *= aspect;       // Correct for aspect ratio

    float r2 = dot(uv_centered, uv_centered); // Squared distance from center (aspect corrected UV space)

    // If r2 is very small, and not caught by eventHorizon check, it can cause issues.
    // The eventHorizonRadius check (world space 'd') should handle the very center.

    // lensingStrength here is our R_E_sq (Einstein radius squared, in aspect-corrected UV units)
    vec2 sample_offset_from_bh_center = uv_centered * (1.0 - lensingStrength / r2);

    sample_offset_from_bh_center.x /= aspect; // De-correct aspect for texture lookup

    vec2 finalUv = bhUv + sample_offset_from_bh_center;

    // Clamp UVs to avoid artifacts from extreme lensing outside texture bounds
    finalUv = clamp(finalUv, 0.0, 1.0);

    gl_FragColor = texture2D(backgroundTexture, finalUv);
}