import * as THREE from "three";

const axis = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();

// Endpoints are in the mesh parent's coordinates. Scratch storage is shared;
// callers update synchronously and retain their own endpoint vectors.
export function fitLink(mesh, a, b) {
  direction.subVectors(b, a);
  const length = direction.length();
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  if (length > 1e-8) mesh.quaternion.setFromUnitVectors(axis, direction.multiplyScalar(1 / length));
  mesh.scale.y = length / mesh.userData.baseLength;
}

export function makeLink(radius, length, material, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.userData.baseLength = length;
  return mesh;
}

// Equal fixed-length links in the transverse plane. The wheel contact remains
// owned by the existing terrain solver; this is a kinematic visual mechanism.
export function solveSuspension(rig, wheelY) {
  const { anchor, hub, elbow, linkLength, side } = rig;
  hub.y = wheelY;
  const dx = hub.x - anchor.x, dy = hub.y - anchor.y;
  const distance = Math.hypot(dx, dy);
  const rise = Math.sqrt(Math.max(0, linkLength * linkLength - distance * distance * 0.25));
  elbow.set((anchor.x + hub.x) * 0.5 - side * dy / distance * rise,
    (anchor.y + hub.y) * 0.5 + side * dx / distance * rise, anchor.z);
  fitLink(rig.upper, anchor, elbow);
  fitLink(rig.lower, elbow, hub);
  rig.joint.position.copy(elbow);
  rig.axle.position.copy(hub);
  // Both telescoping members keep their manufactured length and overlap.
  rig.direction.subVectors(hub, rig.damperAnchor).normalize();
  rig.barrelEnd.copy(rig.damperAnchor).addScaledVector(rig.direction, 0.34);
  rig.rodStart.copy(hub).addScaledVector(rig.direction, -0.34);
  fitLink(rig.barrel, rig.damperAnchor, rig.barrelEnd);
  fitLink(rig.rod, rig.rodStart, hub);
}
