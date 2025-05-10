varying vec2 vUv; // Screen UV coordinates (0 to 1)

uniform sampler2D backgroundTexture; // The galaxy/stars to be lensed
uniform vec2 resolution;             // Screen resolution (width, height)
uniform float time;                  // Time for animation
uniform float backgroundBrightness;  // New: Factor to control background brightness (0.0 to 1.0+)

// Black Hole properties (passed from JavaScript)
uniform vec3 blackHoleWorldPosition;
uniform float lensingStrength;        // Screen-space Einstein radius squared
uniform float eventHorizonRadius;     // World-space radius

// Camera properties (passed from JavaScript)
uniform mat4 viewMatrixInverse;       // camera.matrixWorld
uniform mat4 projectionMatrixInverse; // camera.projectionMatrixInverse
uniform vec3 cameraWorldPosition;

// Function to unproject screen UV to a world space ray direction
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

    if (tca < 0.0 && dot(L,L) > eventHorizonRadius * eventHorizonRadius * 4.0 ) {
        vec2 animatedBgUv = vUv + vec2(sin(time * 0.01) * 0.005, cos(time * 0.015) * 0.005);
        vec4 bgColor = texture2D(backgroundTexture, fract(animatedBgUv));
        gl_FragColor = vec4(bgColor.rgb * backgroundBrightness, bgColor.a); // Apply brightness
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

    vec2 uv_centered = vUv - bhUv;
    float aspect = resolution.x / resolution.y;
    uv_centered.x *= aspect;
    float r2 = dot(uv_centered, uv_centered);

    if (r2 < 0.000001) {
        vec2 animatedDirectUv = vUv + vec2(sin(time * 0.01) * 0.005, cos(time * 0.015) * 0.005);
        vec4 bgColor = texture2D(backgroundTexture, fract(animatedDirectUv));
        gl_FragColor = vec4(bgColor.rgb * backgroundBrightness, bgColor.a); // Apply brightness
        return;
    }
    
    vec2 sample_offset_from_bh_center = uv_centered * (1.0 - lensingStrength / r2);
    sample_offset_from_bh_center.x /= aspect;
    vec2 finalUv = bhUv + sample_offset_from_bh_center;

    finalUv.x += sin(time * 0.01) * 0.005;
    finalUv.y += cos(time * 0.015) * 0.005;
    finalUv = fract(finalUv);

    vec4 lensedColor = texture2D(backgroundTexture, finalUv);
    gl_FragColor = vec4(lensedColor.rgb * backgroundBrightness, lensedColor.a); // Apply brightness
}