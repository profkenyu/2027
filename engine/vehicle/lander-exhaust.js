import * as THREE from "three";
import { float, vec3, uniform, instancedBufferAttribute, fract, sin, cos, exp, uv, smoothstep, positionWorld, varying } from "three/tsl";
import { cfg } from "../config.js";

// Shared by the physical bells and their gas outlets; dimensions are lander-local.
export const LANDER_NOZZLES = Object.freeze([[-1.45, 0.1], [1.45, 0.1], [0, 1.65]]);

// Analytic expanding flow, not CFD or condensed water vapour. GPU billboards
// visualize exhaust density; the local ground plane clips gas below the site.
export class LanderExhaust {
  constructor() {
    const { tier } = cfg();
    const slices = { high: 48, mid: 40, low: 32 }[tier] ?? 40;
    const count = slices * LANDER_NOZZLES.length;
    const origins = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let nozzle = 0; nozzle < LANDER_NOZZLES.length; nozzle++) {
      for (let slice = 0; slice < slices; slice++) {
        const i = (nozzle * slices + slice) * 3;
        origins.set([LANDER_NOZZLES[nozzle][0], 0.45, LANDER_NOZZLES[nozzle][1]], i);
        seeds.set([slice / slices, slice * 2.399963 + nozzle * 2.1, 0.2 + ((slice * 17) % 31) / 38], i);
      }
    }
    this.clock = uniform(0);
    this.power = uniform(0);
    this.length = uniform(7);
    this.groundY = uniform(0);
    this.intensity = 0;
    const origin = instancedBufferAttribute(new THREE.InstancedBufferAttribute(origins, 3));
    const seed = instancedBufferAttribute(new THREE.InstancedBufferAttribute(seeds, 3));
    const age = fract(seed.x.add(this.clock.mul(1.15)));
    const spread = age.mul(age).mul(1.2).add(age.mul(0.22)).mul(seed.z);
    const theta = seed.y.add(age.mul(0.45));
    const flow = vec3(cos(theta).mul(spread), age.mul(this.length).negate(), sin(theta).mul(spread));
    const material = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, depthTest: true });
    material.positionNode = origin.add(flow);
    material.scaleNode = age.mul(2.15).add(0.48);
    material.rotationNode = seed.y;
    material.colorNode = vec3(0.64, 0.68, 0.69);
    const radius = uv().sub(0.5).mul(2).length();
    const soft = exp(radius.mul(radius).mul(-3.6)).mul(float(1).sub(smoothstep(0.72, 1, radius)));
    const life = varying(smoothstep(0, 0.055, age).mul(float(1).sub(smoothstep(0.55, 1, age))));
    const aboveGround = smoothstep(this.groundY.add(0.015), this.groundY.add(0.22), positionWorld.y);
    material.opacityNode = soft.mul(life).mul(aboveGround).mul(this.power).mul(0.16 * 48 / slices);
    const plane = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry().copy(plane);
    plane.dispose();
    geometry.instanceCount = count;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = "lander-engine-exhaust";
    this.mesh.userData.matterPassage = false;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  setPower(intensity, altitude = 0, groundY = 0) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    this.power.value = this.intensity;
    this.length.value = Math.min(8, Math.max(1.1, altitude + 0.7));
    this.groundY.value = groundY;
    this.mesh.visible = this.intensity > 0.001;
  }
  update(now) {
    this.clock.value = now / 1000;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
