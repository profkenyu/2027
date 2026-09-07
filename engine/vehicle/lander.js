import * as THREE from "three";
import {
  Fn,
  float,
  uniform,
  vec3,
  vec4,
  normalize,
  dot,
  abs,
  max,
  mix,
  exp,
  pow,
  cameraPosition,
  normalWorld,
  positionView,
  positionWorld,
  smoothstep as ss
} from "three/tsl";
import { fitLink, makeLink } from "./mechanics.js";
import { cfg } from "../config.js";
import { LanderExhaust, LANDER_NOZZLES } from "./lander-exhaust.js";
const Y = new THREE.Vector3(0, 1, 0);
const LEVEL_PAD = new THREE.Quaternion();
const LEG = Object.freeze({
  sleeveLength: 1.3,
  minimumLength: 1.65,
  reachMargin: 0.015,
  maximumPadTilt: 0.28,
  foldedRadius: 4.15,
  foldedFootY: 1.06,
  forkOffset: 0.16
});
const RESTORATION_PARTS = Object.freeze([
  "FOUNDATION",
  "LOAD PATHS",
  "SERVICE CELLS",
  "PRESSURE HULL",
  "SENSOR VISOR",
  "TRANSFER BRIDGE",
  "SENSOR CROWN",
  "SIGNAL CORE"
]);
const STRUCTURAL_ASSEMBLY_BY_PART = Object.freeze([0, 1, 2, 2, 3, 3, 3, 3]);
const STRUCTURAL_ASSEMBLY_COUNT = 4;
function cylinderBetween(a, b, radius, material, radial = 12) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
  const dir = bv.clone().sub(av), len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, radial), material);
  mesh.position.copy(av).add(bv).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
  mesh.userData.baseLength = len;
  return mesh;
}
function cylinderWithBayCut(radiusTop, radiusBottom, height, radialSegments = 12) {
  // A rectangular transfer corridor must continue past the vehicle's rear
  // wheels. An angular cut closes towards the centre and intersects the bay.
  const radius = Math.max(radiusTop, radiusBottom);
  const halfWidth = 1.53;
  const angle = Math.asin(halfWidth/radius);
  const shape = new THREE.Shape();
  for (let i=0;i<=radialSegments;i++) {
    const theta = Math.PI+angle + i/radialSegments*(Math.PI*2-angle*2);
    const x = Math.sin(theta)*radius, z = Math.cos(theta)*radius;
    if(i===0)shape.moveTo(x,z);else shape.lineTo(x,z);
  }
  shape.lineTo(halfWidth, 0.96);
  shape.lineTo(-halfWidth, 0.96);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth:height,bevelEnabled:false,steps:1});
  geometry.rotateX(Math.PI/2);
  geometry.translate(0,height/2,0);
  return geometry;
}

function shaded(rgb, sheen = 0.08, gloss = 26) {
  const C = cfg();
  const L = normalize(vec3(...C.sun));
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.colorNode = Fn(() => {
    const n = normalize(normalWorld);
    const v = normalize(cameraPosition.sub(positionWorld));
    const ndl = max(dot(n, L), float(0));
    const halfVector = normalize(L.add(v));
    const spec = pow(max(dot(n, halfVector), float(0)), float(gloss)).mul(sheen);
    const rim = pow(float(1).sub(abs(dot(n, v))), float(3)).mul(sheen * 0.14);
    const lit = vec3(...rgb).mul(ndl.mul(1.36).add(0.052)).add(vec3(1, 0.97, 0.91).mul(spec)).add(vec3(0.28, 0.34, 0.4).mul(rim));
    const fog = float(1).sub(exp(positionView.length().mul(-C.atmosphere.fogDensity)));
    return vec4(mix(lit, vec3(...C.color.horizon), ss(0, 1, fog)), 1);
  })();
  return mat;
}
function signalEnvelope(seconds, period = 3.2) {
  const phase = (seconds % period + period) % period;
  const pulse = (start) => {
    const x = phase - start;
    if (x < 0 || x > 0.16) return 0;
    return x < 0.018 ? x / 0.018 : Math.exp(-(x - 0.018) / 0.04);
  };
  return Math.max(pulse(0), pulse(0.17));
}
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
class CryogenicPurge {
  constructor(vents) {
    const low = cfg().clipmap.grid < 450;
    this.vents = vents;
    this.count = low ? 72 : 144;
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.maxLife = new Float32Array(this.count);
    this.color = new Float32Array(this.count * 3);
    this.cursor = 0;
    this.active = false;
    this.last = 0;
    this.nextBurst = 0;
    this.burstStart = -1;
    this.burstIndex = 0;
    this.activeVent = 0;
    this.carry = 0;
    this.forcedUntil = 0;
    this.forcedVentStart = 0;
    this.forcedVentCount = 1;
    this.lastCarrierY = null;
    for (let i = 0; i < this.count; i++) this.pos[i * 3 + 1] = -1e6;
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(this.pos, 3);
    const colour = new THREE.BufferAttribute(this.color, 3);
    position.setUsage(THREE.DynamicDrawUsage);
    colour.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", position);
    geometry.setAttribute("color", colour);
    const material = new THREE.PointsMaterial({
      size: low ? 0.72 : 0.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: low ? 0.31 : 0.36,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexColors: true
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }
  clear() {
    this.life.fill(0);
    this.vel.fill(0);
    this.color.fill(0);
    for (let i = 0; i < this.count; i++) this.pos[i * 3 + 1] = -1e6;
    this.carry = 0;
    this.burstStart = -1;
    this.forcedUntil = 0;
    this.lastCarrierY = null;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
  setActive(active, now) {
    if (active === this.active) return;
    this.active = active;
    this.points.visible = active;
    this.last = now;
    if (active) this.nextBurst = now + 4800;
    else {
      this.clear();
      this.nextBurst = 0;
    }
  }
  reset(now = 0) {
    this.clear();
    this.burstIndex = 0;
    this.last = now;
    this.nextBurst = this.active ? now + 4800 : 0;
  }
  forceBurst(now, ventStart = 0, ventCount = 1, duration = 2100) {
    this.setActive(true, now);
    this.burstIndex++;
    this.burstStart = now;
    this.forcedUntil = now + duration;
    this.forcedVentStart = Math.max(0, Math.min(this.vents.length - 1, ventStart));
    this.forcedVentCount = Math.max(1, Math.min(ventCount, this.vents.length - this.forcedVentStart));
    this.nextBurst = this.forcedUntil + 9e3;
    this.last = now;
  }
  emit(forced = false) {
    const i = this.cursor++ % this.count, p = i * 3;
    const seed = this.cursor + this.burstIndex * 193;
    const ventIndex = forced ? this.forcedVentStart + this.cursor % this.forcedVentCount : this.activeVent;
    const vent = this.vents[ventIndex] ?? this.vents[0];
    const speed = forced ? 1.8 + hash(seed + 3) * 4.2 : 3.5 + hash(seed + 3) * 5.5;
    const dx = vent.direction[0] + (hash(seed + 11) - 0.5) * 0.58;
    const dy = vent.direction[1] + (hash(seed + 23) - 0.5) * 0.42;
    const dz = vent.direction[2] + (hash(seed + 43) - 0.5) * 0.58;
    const length = Math.hypot(dx, dy, dz) || 1;
    this.pos[p] = vent.position[0] + (hash(seed + 31) - 0.5) * 0.1;
    this.pos[p + 1] = vent.position[1] + (hash(seed + 37) - 0.5) * 0.1;
    this.pos[p + 2] = vent.position[2] + (hash(seed + 47) - 0.5) * 0.1;
    this.vel[p] = dx / length * speed;
    this.vel[p + 1] = dy / length * speed;
    this.vel[p + 2] = dz / length * speed;
    this.life[i] = this.maxLife[i] = forced ? 0.35 + hash(seed + 59) * 0.35 : 0.65 + hash(seed + 59) * 0.82;
  }
  update(now, active, carrierY = 0) {
    this.setActive(active, now);
    if (!active) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1e3));
    this.last = now;
    const carrierDeltaY = this.lastCarrierY == null ? 0 : carrierY - this.lastCarrierY;
    this.lastCarrierY = carrierY;
    if (now >= this.nextBurst) {
      this.burstStart = now;
      this.burstIndex++;
      this.activeVent = this.vents.length > 1 ? this.burstIndex % this.vents.length : 0;
      this.pulseA = 110 + hash(this.burstIndex * 17) * 130;
      this.gap = 90 + hash(this.burstIndex * 29) * 170;
      this.pulseB = 240 + hash(this.burstIndex * 41) * 390;
      this.nextBurst = now + this.pulseA + this.gap + this.pulseB + 11e3 + hash(this.burstIndex * 53) * 27e3;
    }
    const age = now - this.burstStart;
    const forced = now < this.forcedUntil;
    const emitting = forced || age >= 0 && (age <= this.pulseA || age >= this.pulseA + this.gap && age <= this.pulseA + this.gap + this.pulseB);
    this.points.material.size = forced ? 0.62 : this.count < 100 ? 0.72 : 0.6;
    this.points.material.opacity = forced ? 0.38 : this.count < 100 ? 0.31 : 0.36;
    if (emitting) {
      const rate = forced ? 120 : 48 + hash(this.burstIndex * 67) * 46;
      this.carry += rate * dt;
      const emitCount = Math.min(forced ? 8 : 5, Math.floor(this.carry));
      this.carry -= emitCount;
      for (let i = 0; i < emitCount; i++) this.emit(forced);
    }
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      const p = i * 3;
      this.pos[p + 1] -= carrierDeltaY;
      this.life[i] -= dt;
      this.vel[p + 1] -= cfg().dust.gravity * dt;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      if (this.life[i] <= 0) {
        this.pos[p + 1] = -1e6;
        this.color[p] = this.color[p + 1] = this.color[p + 2] = 0;
        continue;
      }
      const fade = Math.min(1, this.life[i] / 0.22, (this.maxLife[i] - this.life[i]) / 0.075);
      this.color[p] = 0.66 * fade;
      this.color[p + 1] = 0.72 * fade;
      this.color[p + 2] = 0.75 * fade;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
const HULL_OUTLINE = [
    [0, -3.65],
    [1.95, -3.28],
    [3.35, -2.3],
    [3.65, 0.55],
    [2.85, 2.9],
    [1.55, 3.35],
    [0, 3.42],
    [-1.55, 3.35],
    [-2.85, 2.9],
    [-3.65, 0.55],
    [-3.35, -2.3],
    [-1.95, -3.28]
  ];
function facetedHullGeometry() {
  const outline = HULL_OUTLINE;
  const rings = [
    [3.05, 0.72],
    [3.58, 1],
    [4.38, 1],
    [5.08, 0.76],
    [5.45, 0.46]
  ];
  const positions = [];
  for (const [y, scale] of rings) {
    for (const [x, z] of outline) positions.push(x * scale, y, z * scale);
  }
  const indices = [];
  const n = outline.length;
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      if (r <= 2 && (i === 0 || i === n - 1)) continue;
      const a = r * n + i, b = r * n + (i + 1) % n;
      const d = (r + 1) * n + i, c = (r + 1) * n + (i + 1) % n;
      indices.push(a, d, b, b, d, c);
    }
  }
  const top = positions.length / 3;
  positions.push(0, rings.at(-1)[0], 0);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;

    const offset = (rings.length - 1) * n;
    indices.push(top, offset + j, offset + i);
  }
  // Close the underside around the same full-depth transfer corridor.
  const contour = outline.slice(1).map(([x,z])=>new THREE.Vector2(x*.72,z*.72));
  contour.push(new THREE.Vector2(-1.53,.96),new THREE.Vector2(1.53,.96));
  const capStart = positions.length/3;
  for(const point of contour)positions.push(point.x,rings[0][0],point.y);
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(contour,[]))
    indices.push(capStart+a,capStart+b,capStart+c);
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  geometry.computeVertexNormals();
  return geometry;
}
function sampleSite(heightAt, cx, cz, originX, originZ, dense = false) {
  const dxHome = originX - cx, dzHome = originZ - cz;
  const homeLength = Math.hypot(dxHome, dzHome) || 1;
  const yaw = Math.atan2(-dxHome / homeLength, -dzHome / homeLength);
  const samples = [{ dx: 0, dz: 0, h: heightAt(cx, cz) }];
  const radii = dense ? [2.8, 5.55, 6.4] : [3, 6.4];
  for (const radius of radii) {
    const count = dense ? 12 : radius < 4 ? 4 : 8;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const dx = Math.cos(angle) * radius, dz = Math.sin(angle) * radius;
      samples.push({ dx, dz, h: heightAt(cx + dx, cz + dz) });
    }
  }
  const mean = samples.reduce((sum, p) => sum + p.h, 0) / samples.length;
  let xx = 0, zz = 0, xh = 0, zh = 0;
  for (const p of samples) {
    xx += p.dx * p.dx;
    zz += p.dz * p.dz;
    xh += p.dx * (p.h - mean);
    zh += p.dz * (p.h - mean);
  }
  const ax = xh / Math.max(xx, 1e-6), az = zh / Math.max(zz, 1e-6);
  let residual2 = 0, maxResidual = 0;
  for (const p of samples) {
    const residual = Math.abs(p.h - (mean + ax * p.dx + az * p.dz));
    residual2 += residual * residual;
    maxResidual = Math.max(maxResidual, residual);
  }
  const feet = [];
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3 + yaw;
    feet.push(heightAt(cx + Math.cos(angle) * 5.55, cz + Math.sin(angle) * 5.55));
  }
  const heights = samples.map((p) => p.h).concat(feet);
  const rms = Math.sqrt(residual2 / samples.length);
  const slope = Math.atan(Math.hypot(ax, az)) * 180 / Math.PI;
  const footRange = Math.max(...feet) - Math.min(...feet);
  const range = Math.max(...heights) - Math.min(...heights);
  return {
    x: cx,
    z: cz,
    y: Math.max(...heights) + 0.03,
    yaw,
    slope,
    rms,
    maxResidual,
    footRange,
    range
  };
}
function findLandingSite(heightAt, x, z, heading) {
  const forwardX = -Math.sin(heading), forwardZ = -Math.cos(heading);
  const backX = -forwardX, backZ = -forwardZ;
  const rightX = -forwardZ, rightZ = forwardX;
  const coarse = [];
  for (let back = 0; back <= 30; back += 2) {
    for (let side = -20; side <= 20; side += 2) {
      const distance = Math.hypot(back, side);
      if (distance < 16 || distance > 34) continue;
      const cx = x + backX * back + rightX * side;
      const cz = z + backZ * back + rightZ * side;
      const site = sampleSite(heightAt, cx, cz, x, z, false);
      site.back = back;
      site.side = side;
      site.rank = site.slope * 4 + site.rms * 38 + site.maxResidual * 22 + site.footRange * 8 + Math.hypot(back - 18, Math.abs(side) - 9) * 0.16 + (side < 0 ? 0.4 : 0);
      coarse.push(site);
    }
  }
  coarse.sort((a, b) => a.rank - b.rank);
  const refined = [];
  for (const seed of coarse.slice(0, 12)) {
    for (const db of [-1, 0, 1]) for (const ds of [-1, 0, 1]) {
      const back = seed.back + db, side = seed.side + ds;
      const distance = Math.hypot(back, side);
      if (back < 0 || distance < 16 || distance > 34) continue;
      const cx = x + backX * back + rightX * side;
      const cz = z + backZ * back + rightZ * side;
      const site = sampleSite(heightAt, cx, cz, x, z, true);
      site.back = back;
      site.side = side;
      site.score = site.slope * 4 + site.rms * 38 + site.maxResidual * 22 + Math.max(0, site.footRange - 0.35) * 8 + Math.hypot(back - 18, Math.abs(side) - 9) * 0.16 + (side < 0 ? 0.4 : 0);
      refined.push(site);
    }
  }
  const strict = refined.filter((s) => s.slope <= 2.5 && s.rms <= 0.22 && s.maxResidual <= 0.48 && s.footRange <= 0.5 && s.range <= 1.05);
  const relaxed = refined.filter((s) => s.slope <= 5 && s.rms <= 0.3 && s.maxResidual <= 0.65 && s.footRange <= 0.85 && s.range <= 1.45);
  const candidates = strict.length ? strict : relaxed.length ? relaxed : refined;
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}
export class Lander {
  constructor(heightAt) {
    this.h = heightAt;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.core = new THREE.Group();
    this.crown = new THREE.Group();
    this.beacon = uniform(0);
    this.beaconOverride = null;
    this.legs = [];
    this.purge = null;
    this.rampPivot = null;
    this.ramp = null;
    this.dockLights = [];
    this.holdDowns = [];
    this.holdProgress = 0;
    this.dock = {
      hatchZ: -3.78,
      toeZ: -8.68,
      floorY: 2.04,
      halfWidth: 1.45,
      backZ: 0.8,
      toeY: 0,
      openAngle: -0.36,
      progress: 0
    };
    this.restorationLevel = 0;
    this.structureCount = STRUCTURAL_ASSEMBLY_COUNT;
    this.parts = RESTORATION_PARTS.map((name, index) => ({
      index,
      name,
      assembly: STRUCTURAL_ASSEMBLY_BY_PART[index],
      objects: [],
      wire: null,
      wireMaterial: null,
      state: "wire",
      started: 0
    }));
    this._wireInverse = new THREE.Matrix4();
    this._wireRelative = new THREE.Matrix4();
    this.group.add(this.core);
    this._build();
    this.setLegFold(0);
    this._prepareRestoration();
    this.exhaust = new LanderExhaust();
    this.group.add(this.exhaust.mesh);
  }
  _track(part, ...objects) {
    this.parts[part].objects.push(...objects.filter(Boolean));
  }
  _build() {
    const C = cfg();
    const graphite = shaded([0.055, 0.061, 0.07], 0.1, 30);
    const ceramic = shaded([0.285, 0.3, 0.31], 0.28, 50);
    const dark = shaded([0.01, 0.013, 0.018], 0.03, 16);
    const bayVoid = new THREE.MeshBasicMaterial({
      color: 66051,
      toneMapped: false,
      side: THREE.DoubleSide
    });
    const service = shaded([0.305, 0.145, 0.038], 0.2, 36);
    const metal = shaded([0.175, 0.19, 0.205], 0.38, 58);
    const glass = shaded([0.01, 0.035, 0.052], 0.42, 74);
    const beaconMat = new THREE.MeshBasicNodeMaterial();
    beaconMat.colorNode = vec4(
      vec3(...C.color.beacon).mul(this.beacon.mul(4.2).add(0.018)),
      1
    );
    const underbody = new THREE.Mesh(
      new THREE.CylinderGeometry(2.25, 2.85, 0.82, 8),
      dark
    );
    underbody.position.y = 1.12;
    this.group.add(underbody);
    const stage = new THREE.Mesh(cylinderWithBayCut(3.05, 3.05, 1.38, 16), graphite);
    stage.position.y = 1.92;
    this.group.add(stage);
    const lowerRail = new THREE.Mesh(
      new THREE.CylinderGeometry(2.98, 2.98, 0.12, 8),
      metal
    );
    lowerRail.position.y = 1.26;
    this.group.add(lowerRail);
    const upperRail = new THREE.Mesh(cylinderWithBayCut(2.98, 2.98, 0.12, 18), metal);
    upperRail.position.y = 2.56;
    this.group.add(upperRail);
    this._track(0, underbody, stage, lowerRail, upperRail);
    const serviceCells = [];
    for (let i = 0; i < 4; i++) {
      if (i === 2) continue;
      const a = i * Math.PI * 0.5;
      const bay = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.88, 0.16), service);
      bay.position.set(Math.sin(a) * 3.02, 1.9, Math.cos(a) * 3.02);
      bay.rotation.y = a;
      this.group.add(bay);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.09, 0.035), dark);
      slot.position.set(Math.sin(a) * 3.115, 2.13, Math.cos(a) * 3.115);
      slot.rotation.y = a;
      this.group.add(slot);
      serviceCells.push(bay, slot);
    }
    this._track(2, ...serviceCells);
    const padRadius = 5.55;
    const radial = C.clipmap.grid >= 600 ? 14 : C.clipmap.grid >= 450 ? 10 : 6;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const shoulder = [Math.cos(a) * 2.62, 2.24, Math.sin(a) * 2.62];
      const elbow = [Math.cos(a) * 4.12, 1.35, Math.sin(a) * 4.12];
      const foot = [Math.cos(a) * padRadius, 0.16, Math.sin(a) * padRadius];
      const upper = cylinderBetween(shoulder, elbow, 0.22, ceramic, 8);
      const lower = cylinderBetween(elbow, foot, 0.12, metal, radial);
      const sleeve = makeLink(0.19, LEG.sleeveLength, graphite, radial);
      const middle = makeLink(0.145, LEG.sleeveLength, metal, radial);
      const brace = cylinderBetween(
        [shoulder[0] * 0.93, shoulder[1] - 0.3, shoulder[2] * 0.93],
        [foot[0], foot[1] + 0.18, foot[2]],
        0.065,
        graphite,
        10
      );
      this.group.add(upper, lower, brace, sleeve, middle);
      const shoulderJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.52, 12), graphite);
      shoulderJoint.position.set(...shoulder);
      shoulderJoint.quaternion.setFromUnitVectors(Y, new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)));
      this.group.add(shoulderJoint);
      const elbowJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.42, 12), metal);
      elbowJoint.position.set(...elbow);
      elbowJoint.quaternion.copy(shoulderJoint.quaternion);
      this.group.add(elbowJoint);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.78, 0.16, 8), metal);
      pad.position.set(foot[0], 0.08, foot[2]);
      this.group.add(pad);
      const padCore = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.36, 0.19, 8), dark);
      padCore.position.copy(pad.position);
      padCore.position.y += 0.1;
      this.group.add(padCore);
      this.legs.push({
        shoulder,
        elbow,
        foot,
        upper,
        lower,
        sleeve,
        middle,
        brace,
        poseFoot: [0,0,0],
        lowerRest: Math.hypot(foot[0]-elbow[0],foot[1]-elbow[1],foot[2]-elbow[2]),
        upperLength: Math.hypot(elbow[0]-shoulder[0], elbow[1]-shoulder[1], elbow[2]-shoulder[2]),
        normal: new THREE.Vector3(0, 1, 0),
        padRotation: new THREE.Quaternion(),
        a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
        sleeveEnd: new THREE.Vector3(), braceA: new THREE.Vector3(), braceB: new THREE.Vector3(),
        elbowJoint,
        pad,
        padCore,
        deployedElbow: elbow.slice(),
        deployedFoot: foot.slice(),
        foldOffset: [0, 2, 4, 1, 3, 5].indexOf(i) / 5
      });
      this._track(1, upper, lower, sleeve, middle, brace, shoulderJoint, elbowJoint, pad, padCore);
    }
    const hull = new THREE.Mesh(facetedHullGeometry(), graphite);
    this.core.add(hull);
    this._track(3, hull);
    const front = [
      [-3.35, -2.3],
      [-1.95, -3.28],
      [0, -3.65],
      [1.95, -3.28],
      [3.35, -2.3]
    ];
    const sensorVisor = [];
    for (let i = 0; i < front.length - 1; i++) {
      if (i === 1 || i === 2) continue;
      const a = front[i], b = front[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(length * 0.94, 0.43, 0.065), glass);
      const mx = (a[0] + b[0]) * 0.5, mz = (a[1] + b[1]) * 0.5;
      const ml = Math.hypot(mx, mz) || 1;
      visor.position.set(mx + mx / ml * 0.045, 4.08, mz + mz / ml * 0.045);
      visor.rotation.y = Math.atan2(-dz, dx);
      this.core.add(visor);
      sensorVisor.push(visor);
    }
    const ports = [
      { x: -3.35, z: 0.25, rz: Math.PI / 2 },
      { x: 3.35, z: 0.25, rz: Math.PI / 2 }
    ];
    for (const p of ports) {
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 0.78, 10), graphite);
      collar.position.set(p.x, 3.9, p.z);
      collar.rotation.set(p.rx ?? 0, 0, p.rz ?? 0);
      this.core.add(collar);
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.82, 10), dark);
      throat.position.copy(collar.position);
      throat.rotation.copy(collar.rotation);
      this.core.add(throat);
      sensorVisor.push(collar, throat);
    }
    this._track(4, ...sensorVisor);
    const bayDepth = this.dock.backZ - this.dock.hatchZ;
    const bayFloor = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.1, bayDepth), bayVoid);
    bayFloor.position.set(
      0,
      this.dock.floorY - 0.05,
      (this.dock.hatchZ + this.dock.backZ) * 0.5
    );
    this.core.add(bayFloor);
    this.bayFloor = bayFloor;
    const bayBack = new THREE.Mesh(new THREE.PlaneGeometry(3.02, 2.82), bayVoid);
    bayBack.position.set(0, this.dock.floorY + 1.41, this.dock.backZ + 0.12);
    bayBack.rotation.y = Math.PI;
    this.core.add(bayBack);
    this.bayBack = bayBack;
    const bayFrames = [];
    for (const x of [-1.66, 1.66]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.82, 0.48), graphite);
      side.position.set(x, this.dock.floorY + 1.41, this.dock.hatchZ + 0.09);
      this.core.add(side);
      bayFrames.push(side);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.48, 0.18, 0.48), metal);
    lintel.position.set(0, 4.96, this.dock.hatchZ + 0.09);
    this.core.add(lintel);
    bayFrames.push(lintel);
    // Flush wheel lanes reveal support without changing the collision floor.
    for (const side of [-1, 1]) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.006, bayDepth-0.12), metal);
      lane.position.set(side*C.vehicle.chassis.track, this.dock.floorY+0.003,
        (this.dock.hatchZ+this.dock.backZ)*0.5);
      this.core.add(lane); bayFrames.push(lane);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, bayDepth-0.12), graphite);
      sill.position.set(side*1.38, this.dock.floorY+0.06, lane.position.z);
      this.core.add(sill); bayFrames.push(sill);
      for (const axle of [-C.vehicle.chassis.wheelBase, C.vehicle.chassis.wheelBase]) {
        const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.25), metal);
        clamp.position.y = this.dock.floorY + C.vehicle.chassis.wheelR;
        clamp.userData.side = side;
        clamp.userData.axle = axle;
        clamp.userData.designRole = "wheel-hold-down";
        this.core.add(clamp); this.holdDowns.push(clamp); bayFrames.push(clamp);
      }
    }
    this.setHoldDown(0);
    this.portalFrames = bayFrames;
    this.rampPivot = new THREE.Group();
    this.rampPivot.position.set(0, this.dock.floorY, this.dock.hatchZ);
    this.group.add(this.rampPivot);
    const rampLength = this.dock.hatchZ - this.dock.toeZ;
    const rampGeometry = new THREE.BoxGeometry(3.14, 0.12, rampLength);
    rampGeometry.translate(0, 0, -rampLength * 0.5);
    this.ramp = new THREE.Mesh(rampGeometry, graphite);
    this.ramp.position.y = -0.06;
    this.rampPivot.add(this.ramp);
    const rampRibA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, rampLength), metal);
    rampRibA.geometry.translate(0, 0, -rampLength * 0.5);
    rampRibA.position.x = -1.47;
    rampRibA.position.y = -0.065;
    const rampRibB = rampRibA.clone();
    rampRibB.position.x = 1.47;
    this.rampPivot.add(rampRibA, rampRibB);
    const ventCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.17, 0.28, 8),
      metal
    );
    ventCollar.position.set(-3.6, 3.73, 0.15);
    ventCollar.rotation.z = Math.PI * 0.5;
    this.core.add(ventCollar);
    const ventMouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.092, 0.025, 8),
      dark
    );
    ventMouth.position.set(-3.75, 3.73, 0.15);
    ventMouth.rotation.z = Math.PI * 0.5;
    this.core.add(ventMouth);
    this._track(
      5,
      bayFloor,
      bayBack,
      ...bayFrames,
      this.ramp,
      rampRibA,
      rampRibB,
      ...this.dockLights,
      ventCollar,
      ventMouth
    );
    this.purge = new CryogenicPurge([
      { position: [-3.78, 3.73, 0.15], direction: [-1, 0.04, 0.12] },
      { position: [0.58, 6.89, 0.41], direction: [0.18, 0.94, 0.3] }
    ]);
    this.group.add(this.purge.points);
    this.crown.position.set(0, 5.55, 0);
    this.core.add(this.crown);
    const crownParts = [];
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 2.05, 0.42, 8), graphite);
    this.crown.add(crownBase);
    crownParts.push(crownBase);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.18, 0.48), metal);
    blade.position.y = 0.52;
    this.crown.add(blade);
    crownParts.push(blade);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), metal);
      mast.position.set(Math.cos(a) * 0.78, 0.72, Math.sin(a) * 0.78);
      this.crown.add(mast);
      const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.32), dark);
      sensor.position.set(Math.cos(a) * 0.78, 1.1, Math.sin(a) * 0.78);
      sensor.rotation.y = -a;
      this.crown.add(sensor);
      crownParts.push(mast, sensor);
    }
    const upperDirection = new THREE.Vector3(0.18, 0.94, 0.3).normalize();
    const upperVent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.15, 0.28, 8),
      metal
    );
    upperVent.position.set(0.55, 1.2, 0.36);
    upperVent.quaternion.setFromUnitVectors(Y, upperDirection);
    this.crown.add(upperVent);
    const upperMouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.026, 8),
      dark
    );
    upperMouth.position.copy(upperVent.position).addScaledVector(upperDirection, 0.15);
    upperMouth.quaternion.copy(upperVent.quaternion);
    this.crown.add(upperMouth);
    crownParts.push(upperVent, upperMouth);
    this._track(6, ...crownParts);
    const coreHousing = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.46, 1.18), graphite);
    coreHousing.position.set(-0.16, 0.34, 0.08);
    this.crown.add(coreHousing);
    const coreInset = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.13, 0.72), glass);
    coreInset.position.set(-0.16, 0.49, -0.18);
    this.crown.add(coreInset);
    const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.1, 8), metal);
    beaconBase.position.set(0, 0.64, 0);
    this.crown.add(beaconBase);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.16, 8), beaconMat);
    beacon.position.set(0, 0.77, 0);
    this.crown.add(beacon);
    this._track(7, coreHousing, coreInset, beaconBase, beacon);
    this._buildFinish({ ceramic, graphite, metal, dark, service });
  }
  _buildFinish({ ceramic, graphite, metal, dark, service }) {
    // Batch fixed details by restoration stage and material: no per-frame work.
    const batches = new Map();
    const add = (part, material, geometry, position = [0, 0, 0], rotation = 0) => {
      geometry.rotateY(rotation);
      geometry.translate(...position);
      const key = `${part}:${material.uuid}`;
      if (!batches.has(key)) batches.set(key, { part, material, geometries: [] });
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      flat.deleteAttribute("uv");
      batches.get(key).geometries.push(flat);
    };
    const box = (part, mat, size, pos, yaw = 0) => add(part, mat, new THREE.BoxGeometry(...size), pos, yaw);
    const grid = cfg().clipmap.grid;
    const tier = grid >= 600 ? "high" : grid >= 450 ? "mid" : "low";
    const fins = tier === "high" ? 9 : tier === "mid" ? 6 : 4;
    // Recessed joints separate the pressure body from replaceable exterior panels.
    for (const [y0, y1, s0, s1] of [[3.08, 3.58, .72, 1], [3.58, 4.38, 1, 1], [4.38, 5.08, 1, .76], [5.08, 5.45, .76, .46]]) {
      for (let i = 0; i < HULL_OUTLINE.length; i++) {
        if (y0 < 4.4 && (i === 0 || i === 11)) continue;
        const a = HULL_OUTLINE[i], b = HULL_OUTLINE[(i + 1) % HULL_OUTLINE.length];
        const points = [new THREE.Vector3(a[0]*s0,y0,a[1]*s0), new THREE.Vector3(a[0]*s1,y1,a[1]*s1), new THREE.Vector3(b[0]*s1,y1,b[1]*s1), new THREE.Vector3(b[0]*s0,y0,b[1]*s0)];
        const center = points.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(.25);
        const normal = new THREE.Vector3().subVectors(points[1],points[0]).cross(new THREE.Vector3().subVectors(points[3],points[0])).normalize();
        for (const p of points) p.sub(center).multiplyScalar(.945).add(center).addScaledVector(normal,.028);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute([0,1,3,3,1,2].flatMap(j=>points[j].toArray()),3));g.computeVertexNormals();
        add(3,ceramic,g);
      }
    }
    // Side radiator cassettes stay outside the forward transfer aperture.
    for (const side of [-1,1]) {
      const yaw = side * Math.PI / 2;
      box(2,graphite,[1.65,.76,.12],[side*3.62,3.91,.34],yaw);
      for(let i=0;i<fins;i++) box(2,metal,[1.43,.032,.09],[side*3.71,3.62+i*.58/(fins-1),.34],yaw);
      box(2,service,[.34,.44,.035],[side*3.13,1.88,.82],yaw);
      // Narrow sill plates and physical latches frame the dark bay.
      box(5,metal,[.075,2.65,.07],[side*1.59,3.45,-3.84]);
      for(const y of [2.45,4.4]) box(5,ceramic,[.19,.24,.14],[side*1.73,y,-3.88]);
    }
    // Three restrained underside bells; the open profile carries depth without glow.
    for (const [x,z] of LANDER_NOZZLES) {
      const bell = new THREE.LatheGeometry([new THREE.Vector2(.19,.53),new THREE.Vector2(.22,.32),new THREE.Vector2(.32,.09),new THREE.Vector2(.47,-.13),new THREE.Vector2(.44,-.16),new THREE.Vector2(.29,.07),new THREE.Vector2(.17,.3)],tier==='high'?20:tier==='mid'?14:10);
      add(0,metal,bell,[x,.61,z]);
      add(0,dark,new THREE.CylinderGeometry(.18,.18,.04,10),[x,.92,z]);
    }
    for (const {part,material,geometries} of batches.values()) {
      const merged = new THREE.BufferGeometry();
      for (const name of ["position", "normal"]) {
        const length = geometries.reduce((sum, g) => sum + g.attributes[name].array.length, 0);
        const array = new Float32Array(length);
        let offset = 0;
        for (const g of geometries) {
          array.set(g.attributes[name].array, offset);
          offset += g.attributes[name].array.length;
        }
        merged.setAttribute(name, new THREE.BufferAttribute(array, 3));
      }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged,material);
      this.core.add(mesh);
      this._track(part,mesh);
      for(const g of geometries) g.dispose();
    }
  }
  _prepareRestoration() {
    for (const part of this.parts) {
      for (const object of part.objects) {
        object.userData.restorationScale = object.scale.clone();
        object.visible = false;
      }
      const material = new THREE.LineBasicMaterial({
        color: 9414819,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        depthTest: true
      });
      const wire = new THREE.LineSegments(new THREE.BufferGeometry(), material);
      wire.renderOrder = 2;
      this.group.add(wire);
      part.wire = wire;
      part.wireMaterial = material;
    }
  }
  _rebuildWireframes() {
    this.group.updateMatrixWorld(true);
    this._wireInverse.copy(this.group.matrixWorld).invert();
    const point = new THREE.Vector3();
    for (const part of this.parts) {
      const vertices = [];
      for (const object of part.objects) {
        object.updateWorldMatrix(true, false);
        this._wireRelative.multiplyMatrices(this._wireInverse, object.matrixWorld);
        const edges = new THREE.EdgesGeometry(object.geometry, 18);
        const position = edges.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
          point.fromBufferAttribute(position, i).applyMatrix4(this._wireRelative);
          vertices.push(point.x, point.y, point.z);
        }
        edges.dispose();
      }
      part.wire.geometry.dispose();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.computeBoundingSphere();
      part.wire.geometry = geometry;
    }
  }
  setRestorationLevel(level = 0) {
    this.restorationLevel = Math.max(0, Math.min(this.structureCount, Math.floor(level)));
    for (const part of this.parts) {
      const restored = part.assembly < this.restorationLevel;
      part.state = restored ? "solid" : "wire";
      part.started = 0;
      for (const object of part.objects) {
        object.visible = restored;
        object.scale.copy(object.userData.restorationScale);
      }
      part.wire.visible = !restored;
      part.wireMaterial.color.setHex(9414819);
      part.wireMaterial.opacity = 0.3;
    }
    this.beacon.value = 0;
    return this.restorationLevel;
  }
  restorePart(index, now = performance.now()) {
    if (index < 0 || index >= this.structureCount) return false;
    const assembly = this.parts.filter((part) => part.assembly === index);
    if (!assembly.length || assembly.every((part) => part.state !== "wire")) return false;
    for (const part of this.parts) {
      if (part.assembly !== index) continue;
      part.state = "materialising";
      part.started = now;
      part.wire.visible = true;
      part.wireMaterial.color.setHex(16757276);
      part.wireMaterial.opacity = 0.92;
    }
    this.restorationLevel = new Set(
      this.parts.filter((part) => part.state !== "wire").map((part) => part.assembly)
    ).size;
    return true;
  }
  restoreAll(now = performance.now()) {
    if (this.restorationLevel >= this.structureCount) return false;
    for (const part of this.parts) {
      if (part.state === "solid") continue;
      part.state = "materialising";
      part.started = now;
      part.wire.visible = true;
      part.wireMaterial.color.setHex(16757276);
      part.wireMaterial.opacity = 0.92;
    }
    this.restorationLevel = this.structureCount;
    return true;
  }
  get restorationComplete() {
    return this.parts.every((part) => part.state !== "wire");
  }
  _updateRestoration(now) {
    for (const part of this.parts) {
      if (part.state === "wire") {
        part.wire.visible = true;
        part.wireMaterial.opacity = 0.25 + Math.sin(now * 72e-5 + part.index * 0.67) * 0.045;
        continue;
      }
      if (part.state === "solid") {
        part.wire.visible = false;
        continue;
      }
      const progress = Math.max(0, Math.min(1, (now - part.started) / 2200));
      const eased = progress * progress * (3 - 2 * progress);
      const count = Math.max(1, part.objects.length);
      for (let i = 0; i < count; i++) {
        const object = part.objects[i];
        const local = Math.max(0, Math.min(1, progress * 1.32 - i / count * 0.32));
        const settle = local * local * (3 - 2 * local);
        object.visible = local > 0.01;
        object.scale.copy(object.userData.restorationScale).multiplyScalar(0.84 + settle * 0.16);
      }
      part.wire.visible = progress < 1;
      part.wireMaterial.opacity = (1 - eased) * 0.92;
      if (progress >= 1) {
        part.state = "solid";
        part.wire.visible = false;
        for (const object of part.objects) {
          object.visible = true;
          object.scale.copy(object.userData.restorationScale);
        }
      }
    }
  }
  setCompletionHighlight(progress = null) {
    if (progress == null) {
      for (const part of this.parts) {
        part.wire.visible = part.state !== "solid";
        part.wireMaterial.color.setHex(9414819);
        part.wireMaterial.opacity = part.state === "wire" ? 0.3 : 0;
      }
      return null;
    }
    const p = Math.max(0, Math.min(1, progress));
    const registration = this.completionRegistration ??= {
      progress: 0,
      weights: new Float32Array(this.structureCount),
      registered: new Uint8Array(this.structureCount),
      activeIndex: 0,
      core: 0
    };
    registration.progress = p;
    registration.weights.fill(0);
    registration.registered.fill(0);
    let strongest = -Infinity;
    for (const part of this.parts) {
      const centre = 0.08 + part.assembly * 0.13;
      const distance = Math.abs(p - centre);
      const leading = Math.max(0, 1 - distance / 0.18);
      const residue = Math.max(0, 1 - p) * 0.12;
      const opacity = Math.min(0.82, leading * 0.78 + residue);
      registration.weights[part.assembly] = Math.max(
        registration.weights[part.assembly],
        opacity
      );
      registration.registered[part.assembly] = p >= centre ? 1 : 0;
      if (leading > strongest) {
        strongest = leading;
        registration.activeIndex = part.assembly;
      }
      part.wire.visible = opacity > 0.012;
      part.wireMaterial.color.setHex(part.assembly === this.structureCount - 1 ? 16766330 : 16757276);
      part.wireMaterial.opacity = opacity;
    }
    const core = Math.max(0, 1 - Math.abs(p - 0.72) / 0.1);
    registration.core = core;
    this.beacon.value = Math.max(this.beacon.value, core);
    return registration;
  }
  place(x, z, heading, visible = true) {
    const key = `${x.toFixed(3)}:${z.toFixed(3)}:${heading.toFixed(5)}`;
    if (!this.site || this.site.key !== key) {
      this.site = { ...findLandingSite(this.h, x, z, heading), key };
    }
    const { x: px, z: pz, y: baseY, yaw } = this.site;
    this.group.position.set(px, baseY, pz);
    this.group.rotation.y = yaw;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const rampLength = this.dock.hatchZ - this.dock.toeZ;
    // Telescoping deck: solve the deployed span against the actual terrain.
    // Sample both wheel lanes so the ramp lip cannot be buried by cross-slope.
    let span = rampLength;
    for (let i = 0; i < 80; i++, span += 0.25) {
      const z = this.dock.hatchZ - span;
      let toeY = -Infinity;
      for (const x of [-this.dock.halfWidth, 0, this.dock.halfWidth]) {
        toeY = Math.max(toeY, this.h(px + x*cos + z*sin, pz - x*sin + z*cos) - baseY + 0.04);
      }
      this.dock.entryZ = z;
      this.dock.toeY = toeY;
      this.dock.openAngle = Math.atan2(toeY - this.dock.floorY, span);
      this.dock.extension = Math.hypot(span, toeY - this.dock.floorY) / rampLength;
      if (Math.abs(this.dock.openAngle) <= 0.48) break;
    }
    this.setRamp(0);
    this.setHoldDown(0);
    this.setDockLights(1);
    for (const leg of this.legs) {
      const local = new THREE.Vector3(leg.foot[0], 0, leg.foot[2]).applyAxisAngle(Y, this.group.rotation.y);
      const footY = this.h(px + local.x, pz + local.z) - baseY;
      const foot = [leg.foot[0], footY + 0.16, leg.foot[2]];
      const elbow = [leg.elbow[0], 1.35 + footY * 0.18, leg.elbow[2]];
      // Central-difference terrain normal, expressed in lander coordinates.
      const wx = px + local.x, wz = pz + local.z, sample = 0.35;
      const nx = (this.h(wx-sample,wz)-this.h(wx+sample,wz))/(2*sample);
      const nz = (this.h(wx,wz-sample)-this.h(wx,wz+sample))/(2*sample);
      leg.normal.set(nx*cos-nz*sin, 1, nx*sin+nz*cos).normalize();
      const tilt = Math.acos(Math.max(-1,Math.min(1,leg.normal.y)));
      leg.padRotation.setFromUnitVectors(Y, leg.normal);
      if (tilt > LEG.maximumPadTilt) {
        leg.padRotation.identity().slerp(new THREE.Quaternion().setFromUnitVectors(Y, leg.normal), LEG.maximumPadTilt / tilt);
        leg.normal.copy(Y).applyQuaternion(leg.padRotation);
      }
      leg.deployedElbow = elbow.slice();
      leg.deployedFoot = foot.slice();
      leg.lowerRest = Math.hypot(foot[0]-elbow[0],foot[1]-elbow[1],foot[2]-elbow[2]);
    }
    this.setLegFold(0);
    for (const part of this.parts) for (const object of part.objects)
      object.userData.restorationScale.copy(object.scale);
    this._rebuildWireframes();
    this.purge?.reset(typeof performance === "undefined" ? 0 : performance.now());
    this.group.visible = visible;
  }
  setRamp(progress = 0) {
    this.dock.progress = Math.max(0, Math.min(1, progress));
    if (!this.rampPivot) return;
    const eased = this.dock.progress * this.dock.progress * (3 - 2 * this.dock.progress);
    this.rampPivot.rotation.x = Math.PI * 0.5 + (this.dock.openAngle - Math.PI * 0.5) * eased;
    this.rampPivot.scale.z = 1 + ((this.dock.extension ?? 1) - 1) * eased;
  }
  setDockLights(fraction = 1) {
    const remaining = Math.max(0, Math.min(1, fraction));
    const pairs = 3;
    for (let i = 0; i < this.dockLights.length; i++) {
      const pair = Math.floor(i / 2);
      this.dockLights[i].material.opacity = pair < Math.ceil(remaining * pairs) ? 0.92 : 0.025;
    }
  }
  setBeaconOverride(value = null) {
    this.beaconOverride = value == null ? null : Math.max(0, Math.min(1, value));
  }
  setFlightThrust(intensity = 0, altitude = 0, groundY = this.site?.y ?? 0) {
    this.exhaust.setPower(intensity, altitude, groundY);
  }
  // Inverse kinematics retains the upper link length. The three-stage lower
  // damper supplies terrain reach and compression; each sleeve stays rigid.
  _poseLeg(leg, foot, compression = 0, fold = 0) {
    const angle = Math.atan2(leg.shoulder[2], leg.shoulder[0]);
    const cx = Math.cos(angle), cz = Math.sin(angle);
    const r0 = Math.hypot(leg.shoulder[0], leg.shoulder[2]);
    const r1 = Math.hypot(foot[0], foot[2]);
    const dx = r1 - r0, dy = foot[1] - leg.shoulder[1];
    const distance = Math.max(1e-6, Math.hypot(dx, dy));
    const upper = leg.upperLength;
    const lower = Math.max(LEG.minimumLength, leg.lowerRest - compression, Math.abs(distance - upper) + LEG.reachMargin);
    leg.lowerExtension = lower;
    const along = (upper * upper - lower * lower + distance * distance)/(2 * distance);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    const radius = r0 + dx / distance * along - dy / distance * height;
    const y = leg.shoulder[1] + dy / distance * along + dx / distance * height;
    leg.a.set(...leg.shoulder);
    leg.b.set(cx * radius, y, cz * radius);
    leg.c.set(...foot);
    fitLink(leg.upper, leg.a, leg.b);
    leg.braceA.copy(leg.b).sub(leg.c).normalize().multiplyScalar(LEG.sleeveLength).add(leg.c);
    fitLink(leg.lower, leg.braceA, leg.c);
    leg.sleeveEnd.copy(leg.c).sub(leg.b).normalize().multiplyScalar(LEG.sleeveLength).add(leg.b);
    fitLink(leg.sleeve, leg.b, leg.sleeveEnd);
    leg.braceA.copy(leg.c).sub(leg.b).normalize();
    leg.braceB.copy(leg.b).addScaledVector(leg.braceA, (lower - LEG.sleeveLength) * 0.5);
    leg.sleeveEnd.copy(leg.braceB).addScaledVector(leg.braceA, LEG.sleeveLength);
    fitLink(leg.middle, leg.braceB, leg.sleeveEnd);
    // A second upper member forms a fork instead of a stretching diagonal.
    leg.braceA.copy(leg.a);
    leg.braceB.copy(leg.b);
    leg.braceA.x -= cz * LEG.forkOffset;
    leg.braceA.z += cx * LEG.forkOffset;
    leg.braceB.x -= cz * LEG.forkOffset;
    leg.braceB.z += cx * LEG.forkOffset;
    fitLink(leg.brace, leg.braceA, leg.braceB);
    leg.elbowJoint.position.copy(leg.b);
    leg.pad.quaternion.copy(leg.padRotation).slerp(LEVEL_PAD, fold);
    leg.padCore.quaternion.copy(leg.pad.quaternion);
    leg.braceA.copy(Y).applyQuaternion(leg.pad.quaternion);
    leg.pad.position.copy(leg.c).addScaledVector(leg.braceA, -0.08);
    leg.padCore.position.copy(leg.c).addScaledVector(leg.braceA, 0.02);
  }
  setLegFold(progress = 0) {
    const p = Math.max(0, Math.min(1, progress));
    for (const leg of this.legs) {
      const staged = Math.max(0, Math.min(1, (p - leg.foldOffset * 0.3) / 0.7));
      const t = staged * staged * (3 - 2 * staged);
      const angle = Math.atan2(leg.shoulder[2], leg.shoulder[0]);
      const foot = leg.poseFoot;
      foot[0] = leg.deployedFoot[0] + (Math.cos(angle) * LEG.foldedRadius-leg.deployedFoot[0])*t;
      foot[1] = leg.deployedFoot[1] + (LEG.foldedFootY - leg.deployedFoot[1])*t;
      foot[2] = leg.deployedFoot[2] + (Math.sin(angle) * LEG.foldedRadius-leg.deployedFoot[2])*t;
      this._poseLeg(leg, foot, 0, t);
    }
    this.legFold = p;
  }
  setLegCompression(progress = 0, stroke = 0.11) {
    const q = Math.max(0, Math.min(1, progress));
    if (this.legFold > 1e-3) return;
    for (const leg of this.legs) {
      const foot = leg.poseFoot;
      foot[0] = leg.deployedFoot[0];
      foot[1] = leg.deployedFoot[1] + stroke * q;
      foot[2] = leg.deployedFoot[2];
      this._poseLeg(leg, foot, stroke * q);
    }
    this.legCompression = q;
  }
  setHoldDown(progress = 0, localZ = -0.58) {
    this.holdProgress = Math.max(0, Math.min(1, progress));
    for (const clamp of this.holdDowns) {
      clamp.position.x = clamp.userData.side * (0.96 - this.holdProgress * 0.225);
      clamp.position.z = localZ + clamp.userData.axle;
    }
  }
  dockingPoint(localZ, localX = 0, localY = null) {
    const yaw = this.group.rotation.y, sin = Math.sin(yaw), cos = Math.cos(yaw);
    const y = localY == null ? this.group.position.y + this.hangarHeight(localZ) : this.group.position.y + localY;
    return new THREE.Vector3(
      this.group.position.x + localX * cos + localZ * sin,
      y,
      this.group.position.z - localX * sin + localZ * cos
    );
  }
  dockingLocal(x, z) {
    const dx = x - this.group.position.x, dz = z - this.group.position.z;
    const yaw = this.group.rotation.y, sin = Math.sin(yaw), cos = Math.cos(yaw);
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  }
  hangarHeight(localZ) {
    const toeZ = this.dock.entryZ ?? this.dock.toeZ;
    if (localZ <= toeZ) return this.dock.toeY;
    if (localZ >= this.dock.hatchZ) return this.dock.floorY;
    const p = (localZ - toeZ) / (this.dock.hatchZ - toeZ);
    return this.dock.toeY + (this.dock.floorY - this.dock.toeY) * p;
  }
  dockingSurface(x, z, terrain) {
    const local = this.dockingLocal(x, z);
    if (Math.abs(local.x) > this.dock.halfWidth || local.z > this.dock.backZ) return terrain;
    const insideBay = local.z >= this.dock.hatchZ;
    if (!insideBay && (this.dock.progress < 0.98 || local.z < (this.dock.entryZ ?? this.dock.toeZ))) return terrain;
    const deck = this.group.position.y + this.hangarHeight(local.z);
    return insideBay ? deck : Math.max(terrain, deck);
  }
  update(now, active = true) {
    this.group.visible = active;
    this.exhaust.update(now);
    this.purge?.update(now, active && this.restorationComplete, this.group.position.y);
    if (!active) return;
    this._updateRestoration(now);
    const t = now * 1e-3;
    this.core.position.y = 0;
    this.crown.rotation.y = this.parts[7].state === "solid" ? Math.sin(t * 0.095) * 0.16 : 0;
    const normalSignal = this.restorationComplete ? signalEnvelope(t - 0.9, 3.2) : 0;
    this.beacon.value = this.beaconOverride == null ? normalSignal : this.beaconOverride;
  }
}
