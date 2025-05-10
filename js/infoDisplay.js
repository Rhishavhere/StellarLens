export function setupInfoDisplay() {
  const infoPanel = document.getElementById('info-panel');
  if (!infoPanel) {
      console.error("Info panel element not found!");
      return null;
  }
  return infoPanel;
}

export function updateInfoPanel(infoPanel, params, blackHoleWorldPosition, cameraPosition, fps) {
  if (!infoPanel || !params.showInfoPanel) {
      if(infoPanel) infoPanel.style.display = 'none';
      return;
  }
  infoPanel.style.display = 'block';

  // Estimate Einstein Radius in world units (approximate)
  // lensingStrength (shader) = R_E_screen^2
  // R_E_screen (pixels) = sqrt(lensingStrength) * (typically screen height / 2 or width / 2 depending on how R_E_sq was normalized)
  // For simplicity, let's say lensingStrength is roughly (R_E_angle)^2 if R_E_angle is small.
  // alpha_E = sqrt(4GM/c^2 * D_LS / (D_L * D_S)) where D are angular diameter distances
  // R_E_world = D_L * theta_E.
  // Our shader's lensingStrength is screen-space. A more direct approach:
  // The parameter `lensingStrength` in the shader is effectively R_E_screen_uv_units_squared.
  // If we assume 1 UV unit in height corresponds to FOV, we can estimate an angle.
  // This is very approximate. A better way would be to tie `lensingStrength` to a physical mass.
  // For now, we'll just display related parameters.
  const bhMassApprox = params.lensingStrength * 1e5; // Arbitrary scaling for display

  infoPanel.innerHTML = `
      <p><strong>Gravitational Lensing Tech Demo</strong></p>
      <p>FPS: ${fps.toFixed(1)}</p>
      <p>Lensing Strength (R<sub>E</sub><sup>2</sup> screen): ${params.lensingStrength.toFixed(5)}</p>
      <p>BH Event Horizon (World): ${params.eventHorizonRadius.toFixed(2)} units</p>
      <p>BH Mass (Approx Display): ${bhMassApprox.toExponential(2)} M<sub>☉</sub></p>
      <hr>
      <p>BH Position (World):
          X: ${blackHoleWorldPosition.x.toFixed(2)},
          Y: ${blackHoleWorldPosition.y.toFixed(2)},
          Z: ${blackHoleWorldPosition.z.toFixed(2)}
      </p>
      <p>Cam Position (World):
          X: ${cameraPosition.x.toFixed(2)},
          Y: ${cameraPosition.y.toFixed(2)},
          Z: ${cameraPosition.z.toFixed(2)}
      </p>
      <hr>
      <p>Visualized Rays: ${params.showRays ? params.numVisualizedRays : 'Off'}</p>
  `;
}