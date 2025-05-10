varying vec2 vUv;

void main() {
    vUv = uv; // Pass UV coordinates to fragment shader
    // Position is expected to be in Normalized Device Coordinates (-1 to 1)
    // if the geometry is a simple PlaneGeometry(2,2)
    gl_Position = vec4(position.xy, 0.0, 1.0);
}