varying vec2 vUv; // UV coordinates of the torus (u wraps around, v goes from inner to outer edge)
varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform float time;
uniform vec3 cameraPosition; // For potential view-dependent effects, not heavily used here yet
uniform vec3 diskColorInner; // e.g., bright yellow/orange
uniform vec3 diskColorOuter; // e.g., red/deep orange
uniform float noiseScale;
uniform float animationSpeed;
uniform float diskOpacity;

// Simple 2D Noise function (you can replace with a more sophisticated one if needed)
// From https://thebookofshaders.com/11/
float random (vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

// 2D Noise based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    // Smooth Interpolation
    // Cubic Hermine Curve.  Same as Smoothstep()
    vec2 u = f*f*(3.0-2.0*f);
    // u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.y * u.x;
}


void main() {
    // vUv.x goes around the torus (0 to 1)
    // vUv.y goes from inner radius to outer radius of the torus tube (0 to 1)

    float angle = vUv.x * 2.0 * 3.14159265; // Angle around the disk
    float radiusFactor = vUv.y; // Normalized distance from inner to outer edge of tube

    // Animate the noise pattern to simulate swirling
    float animatedAngle = angle + time * animationSpeed * 0.2; // Swirl based on time

    // Create some radial bands and noisy turbulence
    // Noise coordinates: use animated angle and radiusFactor
    vec2 noiseCoord = vec2(animatedAngle * 3.0 , radiusFactor * 5.0) * noiseScale; // Repeat pattern more around circumference
    noiseCoord.x += time * animationSpeed * 0.5; // Add some overall drift to the noise

    float n = noise(noiseCoord);
    n = pow(n, 1.5); // Enhance contrast

    // Add some radial streaks/bands
    float bands = sin(animatedAngle * 10.0 + n * 5.0) * 0.5 + 0.5; // Bands frequency based on angle & noise
    bands = smoothstep(0.4, 0.6, bands); // Sharpen bands

    // Combine noise and bands
    float intensity = mix(n, bands, 0.6); // Blend noise and bands
    intensity = pow(intensity, 2.0); // Make brighter parts brighter

    // Interpolate color based on radiusFactor (vUv.y) - hotter near the center
    vec3 color = mix(diskColorInner, diskColorOuter, radiusFactor);
    color *= intensity;

    // Add some glow falloff towards the edges of the tube (vUv.y)
    float edgeFalloff = smoothstep(0.0, 0.3, radiusFactor) * smoothstep(1.0, 0.7, radiusFactor);
    color *= edgeFalloff * 2.0; // Multiply by 2 to boost brightness before bloom

    // Add a "hotter" inner edge
    float innerEdgeGlow = smoothstep(0.1, 0.0, radiusFactor) * 2.0; // Very bright near vUv.y = 0
    color += diskColorInner * innerEdgeGlow * 0.5;


    // Make the disk more opaque in the center, more transparent at edges
    float alpha = diskOpacity * edgeFalloff;
    alpha = clamp(alpha + innerEdgeGlow * 0.2, 0.0, 1.0);


    // For a more pronounced 3D effect (optional: simulate self-shadowing or thickness)
    // float facingRatio = max(0.0, dot(vNormal, normalize(cameraPosition - vWorldPosition)));
    // color *= mix(0.5, 1.0, facingRatio); // Darken parts facing away

    gl_FragColor = vec4(color, alpha);
}