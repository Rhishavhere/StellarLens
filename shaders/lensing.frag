varying vec2 vUv; // Screen UV coordinates (0 to 1)

uniform sampler2D backgroundTexture; // The galaxy/stars to be lensed
uniform vec2 resolution;             // Screen resolution (width, height)
uniform float time;                  // Time for animation

// Black Hole properties (passed from JavaScript)
uniform vec3 blackHoleWorldPosition;
uniform float lensingStrength;
uniform float eventHorizonRadius;

// Camera properties (passed from JavaScript)
uniform mat4 viewMatrixInverse;
uniform mat4 projectionMatrixInverse;
uniform vec3 cameraWorldPosition;

vec3 getRayDirection(vec2 screenUv, vec3 camPos, mat4 projInv, mat4 viewInv) {
    vec2 ndc = screenUv * 2.0 - 1.0;
    vec4 rayClip = vec4(ndc.x, ndc.y, -1.0, 1.0);
    vec4 rayEye = projInv * rayClip;
    rayEye.xyz /= rayEye.w;
    vec3 worldDir = (viewInv * vec4(rayEye.xyz, 0.0)).xyz;
    return normalize(worldDir);
}

void main() {
    vec3 rayDir = getRayDirection(vUv, cameraWorldPosition, projectionMatrixInverse, viewMatrixInverse);
    vec3 rayOrigin = cameraWorldPosition;

    vec3 L = blackHoleWorldPosition - rayOrigin;
    float tca = dot(L, rayDir);

    // Simplified: Direct background sample for rays not "near" the BH projection.
    // A more robust check for "not lensed" rays would be better.
    // For now, if BH is behind camera, assume no lensing.
    if (tca < 0.0) {
        // Animate background UVs slightly for a distant shimmer/movement
        vec2 animatedBgUv = vUv + vec2(sin(time * 0.01) * 0.005, cos(time * 0.015) * 0.005);
        gl_FragColor = texture2D(backgroundTexture, fract(animatedBgUv)); // Use fract to wrap
        return;
    }

    float d2 = dot(L, L) - tca * tca;
    float d = sqrt(d2);

    if (d < eventHorizonRadius) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    mat4 viewMatrix = inverse(viewMatrixInverse);
    mat4 projectionMatrix = inverse(projectionMatrixInverse);
    vec4 bhClipPos = projectionMatrix * viewMatrix * vec4(blackHoleWorldPosition, 1.0);
    vec2 bhNdc = bhClipPos.xy / bhClipPos.w;
    vec2 bhUv = bhNdc * 0.5 + 0.5;

    vec2 toPixel = vUv - bhUv;
    float aspect = resolution.x / resolution.y;
    toPixel.x *= aspect;

    // Main lensing logic
    vec2 uv_centered = vUv - bhUv;
    uv_centered.x *= aspect;
    float r2 = dot(uv_centered, uv_centered);

    if (r2 < 0.000001) { // Avoid singularity very close to center if not caught by event horizon
        vec2 animatedDirectUv = vUv + vec2(sin(time * 0.01) * 0.005, cos(time * 0.015) * 0.005);
        gl_FragColor = texture2D(backgroundTexture, fract(animatedDirectUv));
        return;
    }

    vec2 sample_offset_from_bh_center = uv_centered * (1.0 - lensingStrength / r2);
    sample_offset_from_bh_center.x /= aspect;
    vec2 finalUv = bhUv + sample_offset_from_bh_center;

    // Animate the source texture coordinates for a 'living' background
    finalUv.x += sin(time * 0.01) * 0.005; // Slow horizontal drift
    finalUv.y += cos(time * 0.015) * 0.005; // Slow vertical drift
    finalUv = fract(finalUv); // Use fract to wrap UVs, creating a seamless scroll

    gl_FragColor = texture2D(backgroundTexture, finalUv);
}