import * as THREE from "three";
import { cfg } from "../config.js";
import { flightProfile } from "./flight-profiles.js";
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const p = clamp01(value);
  return p * p * (3 - 2 * p);
};
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const EPILOGUE_MS = 18e3;
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const CSS = `
#ti-voyage {
  position: fixed;
  z-index: 30;
  inset: var(--frame-top) 0 var(--frame-bottom);
  pointer-events: none;
  opacity: 0;
  transition: opacity 1.2s;
  color: rgba(224, 228, 232, .78);
  font: 9px/1.6 "DM Mono", monospace;
  letter-spacing: .2em;
}
body.ti-voyage #ti-voyage {
  opacity: 1;
}
body.ti-voyage #ti-monitor,
body.ti-voyage #fh-hud,
body.ti-voyage #fh-mission,
body.ti-voyage #ti-transfer-trigger {
  opacity: 0 !important;
  pointer-events: none !important;
}
#ti-voyage-route {
  position: absolute;
  left: max(24px, env(safe-area-inset-left));
  bottom: max(38px, calc(env(safe-area-inset-bottom) + 20px));
  border-left: 2px solid #ffb21c;
  padding: 3px 0 3px 13px;
  background:
    linear-gradient(
      90deg,
      rgba(2, 3, 4, .72),
      transparent);
}
#ti-voyage-route b {
  display: block;
  font-weight: 400;
  font-size: 12px;
  color: rgba(255, 178, 28, .92);
}
#ti-voyage-route span {
  display: block;
  color: rgba(205, 214, 220, .42);
}
#ti-voyage-lock {
  position: absolute;
  right: max(22px, env(safe-area-inset-right));
  top: 28px;
  text-align: right;
  color: rgba(205, 214, 220, .34);
}
#ti-voyage-lock i {
  display: inline-block;
  width: 38px;
  height: 1px;
  margin: 0 7px 3px;
  background: #ffb21c;
  opacity: .68;
}
@media (max-width: 760px) {
  #ti-voyage-route {
    left: max(15px, env(safe-area-inset-left));
    bottom: max(66px, calc(env(safe-area-inset-bottom) + 54px));
  }
  #ti-voyage-lock {
    right: max(14px, env(safe-area-inset-right));
    top: 18px;
  }
}
`;
// Distant stars remain in an inertial frame: no streaks or translational parallax.
function starLayer(count, size, seed) {
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = hash(seed + i * 7) * 2 - 1;
    const angle = hash(seed + i * 11 + 19) * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(angle) * r * 420, y * 420, Math.sin(angle) * r * 420], i * 3);
    const brightness = .12 + Math.pow(hash(seed + i * 13 + 47), 5) * .88;
    const warm = hash(seed + i * 17 + 5);
    colors.set([brightness * (warm > .7 ? 1 : .82), brightness * .89, brightness * (warm > .7 ? .72 : 1)], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size, sizeAttenuation: false, vertexColors: true, transparent: true,
    opacity: 0, depthWrite: false, toneMapped: false
  }));
  points.frustumCulled = false;
  return { group: points, points };
}
export class VoyageSequence {
  constructor({ lander, rover, camera, ambient, passage = null, onSwap, onSpace, onCue, onComplete, onLandingDust }) {
    this.lander = lander;
    this.rover = rover;
    this.camera = camera;
    this.ambient = ambient;
    this.passage = passage;
    this.onSwap = onSwap;
    this.onSpace = onSpace;
    this.onCue = onCue;
    this.onComplete = onComplete;
    this.onLandingDust = onLandingDust;
    this.phase = "idle";
    this.t0 = 0;
    this.destination = null;
    this.baseY = 0;
    this.swapped = false;
    this.swapPending = false;
    this.egressPlaced = false;
    this.landingRegolith = false;
    this.liftReleased = false;
    this.foldCued = false;
    this.nextExhaustDustAt = 0;
    this._camera = new THREE.Vector3();
    this._aim = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._surface = (x, z, terrain) => this.lander.dockingSurface(x, z, terrain);
    this.group = new THREE.Group();
    const { tier } = cfg();
    const stars = { high: 1800, mid: 1200, low: 700 }[tier] ?? 1200;
    this.layers = [starLayer(stars, .85, 17), starLayer(Math.round(stars * .08), 1.25, 701)];
    this.group.name = 'inertial-starfield';
    this.group.add(...this.layers.map(layer => layer.group));
    this.departureProfile = flightProfile('terra');
    this.arrivalProfile = flightProfile('terra');
    this.flightOrigin = new THREE.Vector3();
    this.group.visible = false;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.overlay = document.createElement("div");
    this.overlay.id = "ti-voyage";
    this.overlay.innerHTML = '<div id="ti-voyage-route"></div><div id="ti-voyage-lock"><i></i>INERTIAL FRAME / DISTANT STARS</div>';
    document.body.appendChild(this.overlay);
    this.route = this.overlay.querySelector("#ti-voyage-route");
  }
  get active() {
    return this.phase !== "idle" && this.phase !== "arrived";
  }
  get inSpace() {
    return this.phase === "transit";
  }
  start(destination, now = performance.now()) {
    if (this.active || !destination) return false;
    this.departureProfile = this.arrivalProfile;
    this.arrivalProfile = flightProfile(destination.key ?? destination.mode);
    this.flightOrigin.copy(this.lander.group.position);
    this.destination = destination;
    this.phase = "hold";
    this.t0 = now;
    this.baseY = this.lander.group.position.y;
    this.swapped = false;
    this.swapPending = false;
    this.egressPlaced = false;
    this.landingRegolith = false;
    this.liftReleased = false;
    this.foldCued = false;
    this.nextExhaustDustAt = 0;
    this.lander.setFlightThrust?.(0);
    this.lander.group.scale.setScalar(1);
    this.rover.auto = false;
    this.rover.scriptedDrive = { throttle: 0, steer: 0 };
    this.rover.surfaceOverride = this._surface;
    this.ambient?.setVoyage(true);
    this.route.innerHTML = `<b>${destination.id} \xB7 ${destination.label}</b><span>DEST X ${destination.start[0] >= 0 ? "+" : ""}${destination.start[0].toFixed(0)} \xB7 Z ${destination.start[1] >= 0 ? "+" : ""}${destination.start[1].toFixed(0)}</span>`;
    this.onCue?.("flight-lock", now, destination);
    return true;
  }
  async beforeRover(now) {
    if (!this.active) return;
    this.lander.setFlightThrust?.(0);
    const elapsed = now - this.t0;
    this.rover.scriptedDrive = { throttle: 0, steer: 0 };
    if (this.phase === "hold") {
      if (elapsed >= 1500) {
        this.phase = "lift";
        this.t0 = now;
        this.baseY = this.lander.group.position.y;
        this.lander.setRamp(0);
        this.lander.setLegFold(0);
        this.ambient?.transferCue("mass");
        this.onCue?.("lift", now, this.destination);
      }
      return;
    }
    if (this.phase === "lift") {
      const { ignitionMs: buildMs, liftMs: flightMs, height, lateral } = this.departureProfile;
      if (elapsed < buildMs) {
        this.lander.group.position.y = this.baseY + smooth(elapsed / buildMs) * 0.018;
      } else {
        const p = smooth((elapsed - buildMs) / flightMs);
        this.lander.group.position.y = this.baseY + 0.018 + p * (height - .018);
        this.lander.group.position.x = this.flightOrigin.x + lateral[0] * p * p;
        this.lander.group.position.z = this.flightOrigin.z + lateral[1] * p * p;
      }
      if (!this.liftReleased && elapsed >= buildMs) {
        this.liftReleased = true;
        this.ambient?.transferCue("release");
      }
      const fold = smooth((elapsed - 920) / 3100);
      const ignition = smooth(elapsed / buildMs);
      const cutoff = 1 - smooth((elapsed - buildMs - flightMs + 500) / 500);
      this._engineThrust(ignition * cutoff, this.lander.group.position.y - this.baseY, now);
      this.lander.setLegFold(fold);
      if (!this.foldCued && elapsed >= 920) {
        this.foldCued = true;
        this.onCue?.("fold", now, this.destination);
      }
      if (elapsed >= buildMs + flightMs) {
        this.lander.group.position.y = this.baseY + height;
        this.lander.setLegFold(1);
        this.phase = "transit";
        this.lander.setFlightThrust?.(0);
        this.t0 = now;
        this.group.visible = true;
        document.body.classList.add("ti-voyage");
        this.passage?.start(now);
        this.onSpace?.(true);
        this.ambient?.transferCue("charge");
        this.onCue?.("transit", now, this.destination);
      }
      return;
    }
    if (this.phase === "transit") {
      await this.passage?.update(now);
      const p = clamp01(elapsed / 15e3);
      const envelope = smooth(p / 0.12) * (1 - smooth((p - 0.84) / 0.16));
      for (const layer of this.layers) layer.points.material.opacity = envelope;
      const vanish = smooth((p - 0.12) / 0.88);
      this.lander.group.scale.setScalar(1 - vanish * 0.955);
      if (!this.swapped && !this.swapPending && elapsed >= 6400) {
        this.swapPending = true;
        await this.onSwap?.(this.destination);
        this.rover.stowedIn = this.lander;
        this.rover.surfaceOverride = this._surface;
        this.swapped = true;
        this.swapPending = false;
        this.baseY = this.lander.group.position.y;
        this.flightOrigin.copy(this.lander.group.position);
        this.lander.setLegFold(1);
        this.lander.group.position.y = this.baseY + this.arrivalProfile.height;
        this.passage?.captureTarget();
      }
      if (elapsed >= 15e3 && this.swapped) {
        this.group.visible = false;
        document.body.classList.remove("ti-voyage");
        this.passage?.finish();
        this.onSpace?.(false);
        this.lander.group.scale.setScalar(1);
        this.phase = "descent";
        this.t0 = now;
        this.baseY = this.lander.site.y;
        this.ambient?.transferCue("arrival");
        this.onCue?.("descent", now, this.destination);
      }
      return;
    }
    if (this.phase === "descent") {
      const { descentMs, height, lateral, brakePower } = this.arrivalProfile;
      const t = clamp01(elapsed / descentMs);
      const p = 1 - Math.pow(1 - smooth(t), brakePower);
      const altitude = (1 - p) * height;
      const traverse = 1 - smooth(Math.min(1, t / .78));
      this.lander.group.position.x = this.flightOrigin.x + lateral[0] * traverse;
      this.lander.group.position.z = this.flightOrigin.z + lateral[1] * traverse;
      this.lander.group.position.y = this.baseY + altitude;
      const ignition = smooth(elapsed / 320);
      this._engineThrust(ignition * (0.56 + 0.44 * (1 - altitude / height)), altitude, now);
      this.lander.setLegFold(1 - smooth((p - 0.42) / 0.5));
      if (!this.landingRegolith && altitude <= 2.7) {
        this.landingRegolith = true;
        this.onLandingDust?.({
          x: this.lander.group.position.x,
          y: this.baseY,
          z: this.lander.group.position.z
        }, now, this.destination);
      }
      if (elapsed >= descentMs) {
        this.lander.group.position.y = this.baseY;
        this.lander.setLegFold(0);
        this.phase = "settle";
        this.lander.setFlightThrust?.(0);
        this.t0 = now;
        this.ambient?.transferCue("contact");
        this.onCue?.("touchdown", now, this.destination);
      }
      return;
    }
    if (this.phase === "settle") {
      const attack = smooth(elapsed / 160);
      const release = 1 - smooth((elapsed - 160) / 940);
      const compression = elapsed < 160 ? attack : release;
      this.lander.group.position.y = this.baseY - compression * 0.11;
      this.lander.setLegCompression(compression, 0.11);
      if (elapsed >= 1100) {
        this.lander.group.position.y = this.baseY;
        this.lander.setLegCompression(0);
        this.ambient?.setVoyage(false);
        this.phase = "deploy";
        this.t0 = now;
        this.lander.setDockLights(1);
      }
      return;
    }
    if (this.phase === "deploy") {
      this.lander.setRamp(smooth(elapsed / 2400));
      if (elapsed >= 2400) {
        this.lander.setRamp(1);
        this.rover.surfaceOverride = this._surface;
        const inside = this.lander.dockingPoint(-0.62, 0);
        const outside = this.lander.dockingPoint((this.lander.dock.entryZ ?? this.lander.dock.toeZ) - 2, 0);
        const heading = Math.atan2(-(outside.x - inside.x), -(outside.z - inside.z));
        this.rover.stowedIn = null;
        this.rover.teleport(inside.x, inside.z, heading);
        this.rover.update(0);
        this.rover.group.visible = true;
        this.egressPlaced = true;
        this.phase = "egress";
        this.t0 = now;
        this.onCue?.("egress", now, this.destination);
      }
      return;
    }
    if (this.phase === "egress") {
      const local = this.lander.dockingLocal(this.rover.pos.x, this.rover.pos.z);
      this._target.copy(this.lander.dockingPoint((this.lander.dock.entryZ ?? this.lander.dock.toeZ) - 2, 0));
      const dx = this._target.x - this.rover.pos.x, dz = this._target.z - this.rover.pos.z;
      const desired = Math.atan2(-dx, -dz), error = wrap(desired - this.rover.heading);
      this.rover.scriptedDrive = {
        throttle: local.z < this.lander.dock.hatchZ ? 0.34 : 0.23,
        steer: Math.max(-0.34, Math.min(0.34, error * 1.7))
      };
      if (local.z <= (this.lander.dock.entryZ ?? this.lander.dock.toeZ) - 1.2 || elapsed > 18e3) {
        this.rover.scriptedDrive = { throttle: 0, steer: 0 };
        this.rover.surfaceOverride = null;
        this.phase = "close";
        this.t0 = now;
      }
      return;
    }
    if (this.phase === "close") {
      this.lander.setRamp(1 - smooth(elapsed / 2200));
      if (elapsed >= 2200) {
        this.lander.setRamp(0);
        this.rover.speed = 0;
        this.rover.auto = false;
        this.rover.missionHold = true;
        this.rover.scriptedDrive = { throttle: 0, steer: 0 };
        if (this.destination?.mission) {
          this.phase = "arrived";
          this.t0 = now;
          this.rover.scriptedDrive = null;
          this.rover.surfaceOverride = null;
          document.body.classList.remove("ti-epilogue", "ti-epilogue-quiet");
          this.onComplete?.(this.destination, now);
        } else {
          this.phase = "epilogue";
          this.t0 = now;
          document.body.classList.add("ti-epilogue");
          this.onCue?.("epilogue", now, this.destination);
        }
      }
      return;
    }
    if (this.phase === "epilogue") {
      this.rover.auto = false;
      this.rover.missionHold = true;
      const lookBack = 1 - smooth((elapsed - 3900) / 1200);
      this.rover.scriptedDrive = elapsed < 5200 ? { throttle: 0.11 * lookBack, steer: -0.22 * lookBack } : { throttle: 0, steer: 0 };
      const pulseAge = (elapsed - 2700) / 1e3;
      const finalPulse = pulseAge < 0 || pulseAge > 0.48 ? 0 : pulseAge < 0.018 ? pulseAge / 0.018 : Math.exp(-(pulseAge - 0.018) / 0.075);
      this.lander.setBeaconOverride(finalPulse);
      if (elapsed >= 6200) document.body.classList.add("ti-epilogue-quiet");
      if (elapsed >= EPILOGUE_MS) {
        this.phase = "ended";
        this.lander.setBeaconOverride(0);
        this.onComplete?.(this.destination, now);
      }
      return;
    }
  }
  afterRover(now = performance.now()) {
    if (!this.active) return;
    this.group.position.copy(this.camera.position);
    this.group.quaternion.identity();
    if (!this.egressPlaced || ["hold", "fold", "lift", "transit", "descent", "settle", "deploy"].includes(this.phase))
      this.rover.group.visible = false;
  }
  _engineThrust(intensity, altitude, now) {
    this.lander.setFlightThrust?.(intensity, altitude, this.baseY);
    if (intensity < 0.05 || altitude > 7 || now < this.nextExhaustDustAt) return;
    this.nextExhaustDustAt = now + 120;
    this.onLandingDust?.({
      x: this.lander.group.position.x,
      y: this.baseY,
      z: this.lander.group.position.z
    }, now, this.destination, (1 - altitude / 7) * intensity * 0.16);
  }
  reset() {
    this.passage?.finish();
    this.phase = "idle";
    this.destination = null;
    this.departureProfile = this.arrivalProfile = flightProfile('terra');
    this.swapped = false;
    this.swapPending = false;
    this.group.visible = false;
    this.lander.setFlightThrust?.(0);
    this.nextExhaustDustAt = 0;
    document.body.classList.remove("ti-voyage", "ti-epilogue", "ti-epilogue-quiet");
    this.onSpace?.(false);
    this.ambient?.setVoyage(false);
    this.lander.group.scale.setScalar(1);
    this.layers.forEach((layer) => {
      layer.points.material.opacity = 0;

      layer.group.position.set(0, 0, 0);
      layer.group.scale.set(1, 1, 1);
    });
    this.rover.scriptedDrive = null;
    this.rover.surfaceOverride = null;
    this.rover.stowedIn = null;
    this.lander.setBeaconOverride(null);
    this.lander.setLegFold(0);
    this.lander.setLegCompression?.(0);
  }
}
