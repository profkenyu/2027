import * as THREE from "three";
// Reference-inspired optical markings, not a target detector or range measurement.
// Static vector geometry keeps the same sensor identity at every quality tier.
const CSS = `
.ti-rover-reticle{position:fixed;inset:0;z-index:12;pointer-events:none;overflow:hidden;color:rgba(232,236,228,.38)}
.ti-rover-reticle[hidden]{display:none}
.ti-rover-reticle .sensor-frame{position:absolute;inset:var(--frame-top,0px) 0 var(--frame-bottom,0px);overflow:hidden}
.ti-rover-reticle svg{position:absolute;overflow:visible;fill:none;stroke:currentColor;stroke-width:1;vector-effect:non-scaling-stroke}
.ti-rover-reticle text{fill:currentColor;stroke:none;font:9px ui-monospace,monospace;letter-spacing:1.5px}
.ti-rover-reticle .sensor-axis{left:12%;top:56%;width:76%;height:1px;border-top:1px dashed currentColor;opacity:.65}
.ti-rover-reticle .ground-plane{opacity:.68;overflow:hidden}
.ti-rover-reticle .ground-horizon{opacity:.53}
.ti-rover-reticle .ground-horizon-label{font-size:8px;text-anchor:middle}
.ti-rover-reticle .sensor-center{left:50%;top:56%;width:240px;height:180px;transform:translate(-50%,-50%)}
.ti-rover-reticle .sensor-heading{left:50%;top:22%;width:220px;height:65px;transform:translateX(-50%)}
.ti-rover-reticle .sensor-bracket{top:56%;width:28px;height:100px;transform:translateY(-50%)}
.ti-rover-reticle .sensor-left{left:19%}.ti-rover-reticle .sensor-right{right:19%;transform:translateY(-50%) scaleX(-1)}
.ti-rover-reticle .sensor-id{position:absolute;right:7%;top:31%;font:9px/1.8 ui-monospace,monospace;letter-spacing:1.6px;text-align:right;opacity:.8}
@media(max-width:600px){.ti-rover-reticle .sensor-center{width:180px;height:135px}.ti-rover-reticle .sensor-heading{width:170px}.ti-rover-reticle .sensor-left{left:8%}.ti-rover-reticle .sensor-right{right:8%}.ti-rover-reticle .sensor-id{font-size:8px;right:7%;top:39%}}
`;

export class RoverReticle {
  constructor() {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.element = document.createElement('div');
    this.element.className = 'ti-rover-reticle';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `<div class="sensor-frame">
      <svg class="ground-plane"><path class="ground-horizon"/><text class="ground-horizon-label">GROUND HORIZON</text></svg>
      <div class="sensor-axis" style="position:absolute"></div>
      <svg class="sensor-heading" viewBox="0 0 220 65">
        <text x="110" y="9" text-anchor="middle">MAST / OPTICAL</text>
        <path d="M10 27v6m25-6v6m25-6v6m25-6v6m25-10v14m25-10v6m25-6v6m25-6v6m25-6v6M104 49l6-11 6 11"/>
      </svg>
      <svg class="sensor-center" viewBox="0 0 240 180">
        <circle cx="120" cy="90" r="26"/>
        <path d="M120 60v13m0 34v13M90 90h13m34 0h13M91 91a29 29 0 0 0 29 28M139 71l53-53m-3-3h6v6h-6zM120 130v8m-27 14h13m28 0h13m-47 14h6m28 0h6"/>
        <text x="120" y="48" text-anchor="middle">[ R ]</text>
        <text x="157" y="94" style="font-size:7px">SENSOR</text>
      </svg>
      <svg class="sensor-bracket sensor-left" viewBox="0 0 28 100"><path d="M28 1H1v98h27"/></svg>
      <svg class="sensor-bracket sensor-right" viewBox="0 0 28 100"><path d="M28 1H1v98h27"/></svg>
      <div class="sensor-id">ROVER POV<br>WIDE / 8MM</div>
    </div>`;
    document.body.appendChild(this.element);
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.sample = new THREE.Vector3();
    this.ground = this.element.querySelector('.ground-plane');
    this.horizon = this.element.querySelector('.ground-horizon');
    this.horizonLabel = this.element.querySelector('.ground-horizon-label');
    this._resize = () => {
      if (this.element.hidden) return;
      const frame = this.element.querySelector('.sensor-frame').getBoundingClientRect();
      const rect = document.getElementById('gl')?.getBoundingClientRect() ?? frame;
      this.width = rect.width;
      this.height = rect.height;
      this.ground.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      Object.assign(this.ground.style, { left: `${rect.left - frame.left}px`, top: `${rect.top - frame.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    };
    addEventListener('resize', this._resize);
    addEventListener('ti-viewportresize', this._resize);
  }
  setVisible(visible) {
    if (this.element.hidden === !visible) return;
    this.element.hidden = !visible;
    if (visible) this._resize();
  }
  updateGround(camera, position, heightAt, distorted = false) {
    if (this.element.hidden || !this.width || !this.height) return;
    // Project a cross-section of the actual terrain 18 m ahead. A local tangent
    // at the wheels cancels the mast's roll and misses the visible slopes ahead.
    camera.updateMatrixWorld();
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 0.0001) return;
    this.forward.normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);
    const distance = 18, tangent = Math.tan(camera.fov * Math.PI / 360);
    const halfWidth = distance * tangent * camera.aspect * 0.86;
    let path = '', pen = false, labelY = null, labelX = null;
    for (let i = 0; i <= 32; i++) {
      const side = (i / 16 - 1) * halfWidth;
      const x = position.x + this.forward.x * distance + this.right.x * side;
      const z = position.z + this.forward.z * distance + this.right.z * side;
      this.sample.set(x, heightAt(x, z) + 0.025, z).project(camera);
      let sx = this.sample.x * camera.aspect / 2, sy = this.sample.y / 2;
      if (this.sample.z > 1 || this.sample.z < -1) { pen = false; continue; }
      if (distorted) {
        // Invert the same radial UV lookup used by the mast lens.
        const radius = Math.hypot(sx, sy);
        let displayRadius = radius;
        for (let j = 0; j < 8; j++) {
          const r2 = displayRadius * displayRadius, denom = 1 + 0.18 * r2 + 0.02 * r2 * r2;
          const derivative = (1 - 0.18 * r2 - 0.06 * r2 * r2) / (denom * denom);
          if (derivative < 0.02) break;
          displayRadius = Math.max(0, displayRadius - (displayRadius / denom - radius) / derivative);
        }
        const r2 = displayRadius * displayRadius;
        if (Math.abs(displayRadius / (1 + 0.18 * r2 + 0.02 * r2 * r2) - radius) > 0.0001) {
          pen = false;
          continue;
        }
        const scale = radius > 0.000001 ? displayRadius / radius : 1;
        sx *= scale;
        sy *= scale;
      }
      const px = (sx / camera.aspect + 0.5) * this.width;
      const y = (0.5 - sy) * this.height;
      path += `${pen ? 'L' : 'M'}${px.toFixed(2)},${y.toFixed(2)} `;
      pen = true;
      if (i === 16) { labelY = y; labelX = px; }
    }
    this.horizon.setAttribute('d', path);
    this.horizonLabel.style.display = labelY === null ? 'none' : '';
    if (labelY !== null) {
      this.horizonLabel.setAttribute('x', labelX);
      this.horizonLabel.setAttribute('y', labelY - 10);
    }
  }
  dispose() {
    removeEventListener('resize', this._resize);
    removeEventListener('ti-viewportresize', this._resize);
    this.element.remove();
    this.style.remove();
  }
}
