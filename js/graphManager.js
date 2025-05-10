// js/graphManager.js
import * as THREE from 'three';

let canvas, ctx;
const PADDING = 25; // Padding around the graph
const TICK_LENGTH = 5;
let graphData = []; // Stores {x_uv: value, y_deflection: value}

export function setupGraphCanvas(params) {
    canvas = document.getElementById('lensing-graph-canvas');
    if (!canvas) {
        console.error("Lensing graph canvas not found!");
        return null;
    }
    // Set actual drawing resolution (higher for crispness if needed, then scale down with CSS)
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio); // Scale context for HiDPI

    toggleGraphVisibility(params.showLensingGraph);
    return canvas;
}

export function toggleGraphVisibility(show) {
    if (canvas) {
        canvas.style.display = show ? 'block' : 'none';
    }
}

// Calculate data for the graph
// Plotting Deflection ~ LensingStrength / r_uv vs. r_uv
function calculateGraphData(params, blackHoleWorldPosition, camera, screenResolution) {
    graphData = [];
    if (!canvas || !params.showLensingGraph) return;

    // We need bhUv (black hole center in UV space [0,1])
    // This logic is similar to the shader's projection of blackHoleWorldPosition
    const tempVector = blackHoleWorldPosition.clone();
    tempVector.project(camera); // To NDC
    const bhUv = new THREE.Vector2(tempVector.x * 0.5 + 0.5, tempVector.y * 0.5 + 0.5);
    // Note: shader uses (1.0 - bhUv.y) if origin is bottom-left. Here, let's assume UVs are consistent.
    // The actual bhUv is not strictly needed if we plot relative to r=0 on the graph's X-axis.

    const numPoints = 100; // Number of points to calculate for the graph
    const max_r_uv_plot = 0.5; // Max UV distance from center to plot (e.g., edge of screen if BH is centered)
    const min_r_uv_plot = 0.001; // Min UV distance to avoid singularity

    for (let i = 0; i <= numPoints; i++) {
        const r_uv = min_r_uv_plot + (i / numPoints) * (max_r_uv_plot - min_r_uv_plot);
        let deflection_metric = 0;
        if (r_uv > 0) { // Avoid division by zero
            deflection_metric = params.lensingStrength / r_uv;
        }
        graphData.push({ x_uv: r_uv, y_deflection: deflection_metric });
    }
}


// Draw the calculated graph data
export function drawLensingGraph(params, blackHoleWorldPosition, camera, screenResolution) {
    if (!canvas || !ctx || !params.showLensingGraph) return;

    calculateGraphData(params, blackHoleWorldPosition, camera, screenResolution);

    // Effective drawing dimensions (CSS dimensions)
    const canvasCssWidth = canvas.offsetWidth;
    const canvasCssHeight = canvas.offsetHeight;

    ctx.clearRect(0, 0, canvasCssWidth, canvasCssHeight); // Use CSS dimensions for clearing

    // Graph drawing area
    const graphWidth = canvasCssWidth - 2 * PADDING;
    const graphHeight = canvasCssHeight - 2 * PADDING;

    if (graphData.length === 0) return;

    // Find data ranges
    const maxXuv = Math.max(...graphData.map(p => p.x_uv));
    let maxYdefl = Math.max(...graphData.map(p => p.y_deflection));
    if (!isFinite(maxYdefl) || maxYdefl === 0) maxYdefl = 0.1; // Default if no data or flat line
    const minYdefl = 0; // Deflection is positive

    // Clip Y to make graph readable if deflection is too high near center
    const Y_CLIP_MAX_FACTOR = 1.5; // Clip Y values to 1.5x the 95th percentile for example
    const sortedY = [...graphData.map(p => p.y_deflection)].sort((a,b) => a-b);
    const practicalMaxY = sortedY[Math.floor(sortedY.length * 0.98)] * Y_CLIP_MAX_FACTOR || maxYdefl;


    // --- Draw Axes ---
    ctx.strokeStyle = 'rgba(150, 150, 200, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING); // Top-left of graph area
    ctx.lineTo(PADDING, canvasCssHeight - PADDING); // Y-axis
    ctx.lineTo(canvasCssWidth - PADDING, canvasCssHeight - PADDING); // X-axis
    ctx.stroke();

    // --- Draw Labels and Ticks ---
    ctx.fillStyle = 'rgba(200, 200, 230, 0.9)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Angular Separation r (UV units)', PADDING + graphWidth / 2, canvasCssHeight - PADDING / 2.5);
    ctx.textAlign = 'left';
    ctx.save();
    ctx.translate(PADDING / 2.5, PADDING + graphHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Rel. Deflection', 0, 0);
    ctx.restore();

    // X-axis ticks
    const numXTicks = 5;
    for (let i = 0; i <= numXTicks; i++) {
        const val = (i / numXTicks) * maxXuv;
        const x = PADDING + (val / maxXuv) * graphWidth;
        ctx.moveTo(x, canvasCssHeight - PADDING);
        ctx.lineTo(x, canvasCssHeight - PADDING + TICK_LENGTH);
        ctx.fillText(val.toFixed(2), x - 10, canvasCssHeight - PADDING + TICK_LENGTH + 10);
    }
    // Y-axis ticks
    const numYTicks = 4;
    for (let i = 0; i <= numYTicks; i++) {
        const val = (i / numYTicks) * practicalMaxY;
        const y = canvasCssHeight - PADDING - (val / practicalMaxY) * graphHeight;
        ctx.moveTo(PADDING, y);
        ctx.lineTo(PADDING - TICK_LENGTH, y);
        ctx.fillText(val.toFixed(3), PADDING - TICK_LENGTH - 20, y + 3);
    }
    ctx.stroke(); // Draw ticks

    // --- Draw Einstein Radius Line ---
    const einsteinRadiusUv = Math.sqrt(params.lensingStrength);
    if (einsteinRadiusUv <= maxXuv) {
        const x_er = PADDING + (einsteinRadiusUv / maxXuv) * graphWidth;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.7)'; // Reddish line
        ctx.setLineDash([2, 2]);
        ctx.moveTo(x_er, PADDING);
        ctx.lineTo(x_er, canvasCssHeight - PADDING);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
        ctx.fillText('Rᴇ', x_er + 2, PADDING + 10);
    }


    // --- Plot Data ---
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.9)'; // Green line for data
    ctx.lineWidth = 1.5;

    graphData.forEach((point, index) => {
        const x = PADDING + (point.x_uv / maxXuv) * graphWidth;
        let y_val = point.y_deflection;
        // Clip y_val if it's excessively large to keep graph readable
        y_val = Math.min(y_val, practicalMaxY);
        const y = canvasCssHeight - PADDING - (y_val / practicalMaxY) * graphHeight;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
}

export function handleGraphResize() {
    if (canvas && ctx) {
        // Update canvas backing store size for HiDPI
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        // Important: Re-apply scale to context after resize
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    // No need to redraw immediately, will be handled by animation loop
}