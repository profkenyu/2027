import * as THREE from 'three';
// Shared physical radiator cassettes: folded on the surface, metered in flight.
export function createFlightHardware(tier,materials={}){
  const group=new THREE.Group(),radiators=[];
  const panelMaterial=materials.graphite??new THREE.MeshStandardMaterial({color:0x252d32,roughness:.82,metalness:.25});
  const frameMaterial=materials.metal??new THREE.MeshStandardMaterial({color:0x777c79,roughness:.48,metalness:.55});
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*3.5,4.25,1.5);group.add(pivot);
    const panel=new THREE.Mesh(new THREE.BoxGeometry(1.8,.055,2.1),panelMaterial);panel.position.x=side*.9;pivot.add(panel);
    const lines=tier==='high'?16:tier==='mid'?10:6;
    const fins=new THREE.InstancedMesh(new THREE.BoxGeometry(1.7,.012,.012),frameMaterial,lines),matrix=new THREE.Matrix4();
    for(let i=0;i<lines;i++){matrix.makeTranslation(side*.9,.035,-.95+1.9*i/(lines-1));fins.setMatrixAt(i,matrix);}pivot.add(fins);
    for(const z of [-1.02,1.02]){const rail=new THREE.Mesh(new THREE.BoxGeometry(1.88,.055,.035),frameMaterial);rail.position.set(side*.9,0,z);pivot.add(rail);}
    const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,2.15,12),frameMaterial);hinge.rotation.x=Math.PI/2;pivot.add(hinge);
    radiators.push({pivot,side});
  }
  group.traverse(o=>{if(o.isMesh){o.userData.flightHardware=true;o.castShadow=true;o.receiveShadow=true;}});
  const setDeployment=value=>{for(const {pivot,side} of radiators)pivot.rotation.z=side*(1-THREE.MathUtils.clamp(value,0,1))*1.25;};setDeployment(0);
  return {group,radiators,setDeployment};
}
