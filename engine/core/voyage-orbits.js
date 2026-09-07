import * as THREE from "three";
import { cfg } from "../config.js";

// Reference-inspired cartographic ellipses, not simulated celestial orbits.
// Camera-local plane sits beyond the transit lander (~24 units away).
const DEPTH = 80;
export class VoyageOrbits {
  constructor() {
    const { tier } = cfg();
    const segments = { high: 320, mid: 224, low: 144 }[tier] ?? 224;
    const vertices = [];
    const angle = -0.36, cosine = Math.cos(angle), sine = Math.sin(angle);
    const point = (t, radius, eccentricity, offset) => {
      const x = Math.cos(t) * radius;
      const y = Math.sin(t) * radius * eccentricity;
      vertices.push(0.12 + offset + x * cosine - y * sine, -0.06 + x * sine + y * cosine, 0);
    };
    for (let orbit = 0; orbit < 9; orbit++) {
      const radius = 0.09 + orbit * 0.063;
      const elongation = orbit < 4 ? 1.05 + orbit * 0.14 : 1.8 + (orbit - 4) * 0.35;
      const offset = orbit < 4 ? 0 : -(orbit - 3) * 0.055;
      for (let step = 0; step < segments; step++) {
        if (orbit % 3 !== 0 && step % 2) continue;
        point(step / segments * Math.PI * 2, radius, elongation, offset);
        point((step + 1) / segments * Math.PI * 2, radius, elongation, offset);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    this.material = new THREE.LineBasicMaterial({
      color: 0xbfc3bb,
      transparent: true,
      opacity: 0.2,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    });
    this.lines = new THREE.LineSegments(geometry, this.material);
    this.lines.name = "voyage-orbital-chart";
    this.lines.position.z = -DEPTH;
    // Stars first, then chart; the opaque lander already owns its depth pixels.
    this.lines.renderOrder = 1;
    this.lines.frustumCulled = false;
  }
  update(camera, envelope) {
    const height = 2 * DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    // Uniform scale preserves ellipses in portrait and landscape.
    const scale = height * Math.min(1, camera.aspect / 0.8);
    this.lines.scale.set(scale, scale, 1);
    this.material.opacity = 0.2 * envelope;
  }
  dispose() {
    this.lines.geometry.dispose();
    this.material.dispose();
  }
}
