import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Geometry adapted from the user's ending_sf.html. Exactly one additional ark.
// Habitat rings are structural geometry; artificial gravity is not simulated.
export function createReferenceArk(tier) {
  const detail = { high: 64, mid: 40, low: 24 }[tier];
  // Narrow edge highlights reveal structure during the close ring passage.
  // Low retains the silhouette while omitting bevel tessellation.
  const box = tier==='low'?new THREE.BoxGeometry(1,1,1):new RoundedBoxGeometry(1,1,1,1,.025);
  const radial=tier==='high'?24:tier==='mid'?16:12;
  const mats = [new THREE.MeshStandardMaterial({ color: 11186613, roughness: 0.66, metalness: 0.35 }), new THREE.MeshStandardMaterial({ color: 2370610, roughness: 0.6, metalness: 0.65 }), new THREE.MeshStandardMaterial({ color: 5595499, roughness: 0.48, metalness: 0.72 }), new THREE.MeshStandardMaterial({ color: 13948626, roughness: 0.72, metalness: 0.2 }), new THREE.MeshStandardMaterial({ color: 11388364, emissive: 9219772, emissiveIntensity: 0.65, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 5514282, roughness: 0.7, metalness: 0.3 })];
  {
    const ship = new THREE.Group();
    ship.name = "sf-migration-ark";
    const batches = mats.map(() => []), batchParts=mats.map(()=>[]), batchFine=mats.map(()=>[]), matrix = new THREE.Matrix4();
    let blueprintPart=4;
    function block(mat, x, y, z, w, h, d, q) {
      matrix.compose(new THREE.Vector3(x, y, z), q || new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      batches[mat].push(matrix.clone());
      batchParts[mat].push(blueprintPart);
      batchFine[mat].push(Math.min(w,h,d)<=3);
    }
    function beam(a, b, r = 3, mat = 2) {
      const av2 = new THREE.Vector3(...a), bv2 = new THREE.Vector3(...b), delta = bv2.clone().sub(av2);
      block(mat, ...av2.add(bv2).multiplyScalar(0.5).toArray(), r, delta.length(), r, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    }
    function mesh(geo, mat, x, y, z) {
      const m = new THREE.Mesh(geo, mats[mat]);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = mat !== 4;
      m.userData.blueprintPart=blueprintPart;
      m.userData.blueprintOmit=mat===4;
      ship.add(m);
      return m;
    }
    block(1, 0, 0, 0, 64, 64, 1010);
    block(0, 0, 35, 15, 36, 9, 900);
    for (const side of [-1, 1]) {
      beam([side * 36, -28, -465], [side * 36, -28, 455], 5);
      for (let z = -450; z < 450; z += 60) {
        beam([side * 37, -30, z], [side * 37, 30, z + 60], 3);
        block(2, side * 39, 0, z, 5, 65, 7);
      }
    }
    for (let j = 0; j < 4; j++) {
      let g = new THREE.CylinderGeometry(55 - j * 8, 65 - j * 7, 40, 8);
      g.rotateX(Math.PI / 2);
      mesh(g, j % 2 ? 3 : 0, 0, 0, 440 + j * 31);
    }
    block(1, 0, 48, 437, 65, 7, 26);
    block(4, 0, 49, 451, 43, 2, 1);
    blueprintPart=1;
    for (const side of [-1, 1]) for (let j = 0; j < 5; j++) {
      const z = -205 + j * 117, x = side * 86;
      beam([side * 27, 0, z], [x, 0, z], 9);
      const geo = new THREE.CylinderGeometry(29, 29, 94, radial);
      geo.rotateX(Math.PI / 2);
      mesh(geo, 3, x, 0, z);
      for (const dz of [-43, 43]) {
        const collar = new THREE.CylinderGeometry(31, 31, 6, radial);
        collar.rotateX(Math.PI / 2);
        mesh(collar, 2, x, 0, z + dz);
      }
      block(1, x, 29, z, 28, 4, 72);
      block(0, x, 32, z, 17, 3, 65);
      for (let k = 0; k < 5; k++) block(4, x + side * 28.6, 7, z - 30 + k * 14, 1, 2, 5);
      block(5, x, 30, z - 23, 18, 1, 8);
    }
    blueprintPart=0;
    for (const z of [-175, 85]) {
      mesh(new THREE.TorusGeometry(176, 10, 6, detail), 1, 0, 0, z);
      mesh(new THREE.TorusGeometry(193, 3, 5, detail), 2, 0, 0, z);
      const segments = tier === "low" ? 16 : 24;
      for (let j = 0; j < segments; j++) {
        const a = j / segments * Math.PI * 2, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
        block(0, 176 * Math.cos(a), 176 * Math.sin(a), z, 29, segments === 16 ? 58 : 38, 35, q);
        block(3, 191 * Math.cos(a), 191 * Math.sin(a), z, 3, segments === 16 ? 51 : 32, 31, q);
        block(4, 176 * Math.cos(a), 176 * Math.sin(a), z + 18, 12, 1.4, 1, q);
      }
      for (let j = 0; j < 6; j++) {
        const a = j * Math.PI / 3;
        beam([32 * Math.cos(a), 32 * Math.sin(a), z], [170 * Math.cos(a), 170 * Math.sin(a), z], 7);
      }
    }
    blueprintPart=3;
    block(1, 0, 0, -401, 130, 110, 163);
    block(0, 0, 60, -403, 104, 10, 139);
    const jets = [];
    for (const side of [-1, 1]) {
      beam([side * 40, -16, -315], [side * 142, -16, -390], 18);
      beam([side * 40, 16, -460], [side * 142, 16, -465], 14);
      const pod = new THREE.CylinderGeometry(43, 37, 191, radial);
      pod.rotateX(Math.PI / 2);
      mesh(pod, 2, side * 142, 0, -426);
      for (let k = 0; k < 5; k++) block(0, side * 142, 41, -350 - k * 31, 44, 7, 20);
    }
    for (const [x, y, r] of [[-142, 0, 32], [142, 0, 32], [-39, -15, 24], [39, -15, 24]]) {
      const nozzle = new THREE.CylinderGeometry(r * 0.65, r, 57, detail, 1, true);
      nozzle.rotateX(Math.PI / 2);
      mesh(nozzle, 1, x, y, -539);
      mesh(new THREE.TorusGeometry(r, 2, 6, detail), 2, x, y, -567);
      const core = mesh(new THREE.CircleGeometry(r * 0.58, detail), 4, x, y, -533);
      core.rotation.y = Math.PI;
    }
    const deployables = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.name='radiator-wing';
      pivot.position.set(side * 83, -28, -323);
      ship.add(pivot);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(156, 3, 165), mats[1]);
      panel.position.x = side * 85;
      pivot.add(panel);
      const ribs = new THREE.InstancedMesh(box, mats[2], 9);
      ribs.userData.blueprintOmit=true;
      for (let k = 0; k < 9; k++) {
        matrix.makeScale(149, 2, 2);
        matrix.setPosition(side * 85, 2, -75 + k * 18.75);
        ribs.setMatrixAt(k, matrix);
      }
      ribs.computeBoundingSphere();
      pivot.add(ribs);
      deployables.push({ pivot, side });
    }
    blueprintPart=4;
    block(2, 0, 72, 285, 19, 92, 24);
    block(3, 0, 115, 285, 51, 12, 33);
    block(1, 0, 115, 303, 45, 5, 2);
    block(4, 0, 115, 304.2, 33, 1, 1);
    beam([0, 120, 280], [0, 153, 280], 1.3);
    batches.forEach((arr, k) => {
      const inst = new THREE.InstancedMesh(box, mats[k], arr.length);
      inst.userData.blueprintParts=batchParts[k];
      inst.userData.blueprintFine=batchFine[k];
      inst.userData.blueprintBox=true;
      inst.userData.blueprintOmit=k===4;
      arr.forEach((m, j) => inst.setMatrixAt(j, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = inst.receiveShadow = k !== 4;
      inst.computeBoundingSphere();
      ship.add(inst);
    });
    ship.userData = { jets, deployables, kind: "migration-ark", design: "segmented-pressure-vessels / twin-habitat-rings / axial-keel" };
    return ship;
  }
}
