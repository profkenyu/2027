import * as THREE from 'three';
import { buildMigrationArk } from './migration-ark.js';
import { uniform, float, vec3, positionLocal, length, max, abs, sqrt, cos, exp, smoothstep, mix } from 'three/tsl';

const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
const Y = new THREE.Vector3(0,1,0);
// Independent approach durations preserve the final quiet tableau at 38 s.
const ARRIVALS = [{start:5,duration:27},{start:7.5,duration:21},{start:6,duration:29},{start:10,duration:24},{start:8.5,duration:22}];
const LANES = [10,-180,230,-330,390];

// A staged migration, not a physical terraforming forecast. The three observed
// sites seed a bounded radial-wave approximation inspired by Bessel Bloom.
export class FirstDawn {
  constructor({scene, camera, heightAt, tier}) {
    this.camera = camera;
    this.heightAt = heightAt;
    this.tier = tier;
    this.group = new THREE.Group();
    this.group.name = 'first-dawn';
    this.group.visible = false;
    scene.add(this.group);
    this.time = uniform(0);
    this.energy = uniform(0);
    this.sources = Array.from({length:3}, () => uniform(new THREE.Vector3()));
    this.strengths = Array.from({length:3}, () => uniform(1));
    this.startPosition = new THREE.Vector3();
    this.startQuaternion = new THREE.Quaternion();
    this.aim = new THREE.Vector3();
    this.destination = new THREE.Vector3();
    this.targetRotation = new THREE.Quaternion();
    this.lookMatrix = new THREE.Matrix4();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.origin = new THREE.Vector3();
    this.ships = [];
    this.materials = [];
    const palette = [0x414d59,0x202b36,0x79858c,0xe2d8b7];
    this.hullMaterials = palette.map(color => {
      const m = new THREE.MeshBasicMaterial({color});
      this.materials.push(m);
      return m;
    });
    const box = new THREE.BoxGeometry(1,1,1);
    this.geometries = [box];
    const add = (parent, geometry, material, x,y,z, sx,sy,sz) => {
      const mesh = new THREE.Mesh(geometry, this.hullMaterials[material]);
      mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); parent.add(mesh);
      return mesh;
    };
    for (let i=0;i<ARRIVALS.length;i++) {
      const ship = buildMigrationArk(i,tier);
      ship.scale.setScalar([1.65,.9,.72,.56,.42][i]);
      this.group.add(ship); this.ships.push(ship);
    }
    const count = tier==='high'?144:tier==='mid'?96:64;
    this.fieldGeometry = new THREE.PlaneGeometry(1,1,count,count);
    this.fieldGeometry.rotateX(-Math.PI/2);
    this.baseGrid = this.fieldGeometry.attributes.position.array.slice();
    let wave = float(0);
    for (let i=0;i<3;i++) {
      const radius = length(positionLocal.xz.sub(this.sources[i].xz));
      const age = this.time.sub(20).sub(i*.7);
      const front = float(1).sub(smoothstep(age.mul(13),age.mul(13).add(18),radius));
      const phase = radius.mul(.22).sub(age.mul(1.8));
      // Finite radial asymptotic envelope; no singularity at a source.
      const radial = cos(phase.sub(Math.PI/4)).div(sqrt(max(radius.mul(.22),float(1))));
      wave = wave.add(radial.mul(front).mul(exp(radius.mul(-.005))).mul(this.strengths[i]));
    }
    const fieldMaterial = new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide});
    fieldMaterial.positionNode = vec3(positionLocal.x,positionLocal.y.add(abs(wave).mul(.18).mul(this.energy)),positionLocal.z);
    fieldMaterial.colorNode = mix(vec3(.12,.3,.36),vec3(.68,.77,.73),smoothstep(float(.25),float(1),abs(wave)));
    fieldMaterial.opacityNode = abs(wave).mul(abs(wave)).mul(.16).mul(this.energy);
    this.field = new THREE.Mesh(this.fieldGeometry,fieldMaterial);
    this.field.name='terraforming-first-interference';
    this.field.frustumCulled=false;
    this.group.add(this.field);
    this.materials.push(fieldMaterial);
    this.markers = Array.from({length:3}, () => {
      const marker = new THREE.Group();
      for (let i=0;i<3;i++) add(marker,box,2,(i-1)*1.3,2.5,0,.22,5,.22);
      add(marker,box,3,0,5,0,3,.12,.2);
      this.group.add(marker); return marker;
    });
    this.active=false;
    this.elapsed=0;
  }
  start({rover, sites, now}) {
    this.active=true;
    this.group.visible=true;
    this.t0=now;
    this.elapsed=0;
    this.startPosition.copy(this.camera.position);
    this.startQuaternion.copy(this.camera.quaternion);
    this.startFov=this.camera.fov;
    this.origin.set(rover.pos.x,this.heightAt(rover.pos.x,rover.pos.z),rover.pos.z);
    this.camera.getWorldDirection(this.forward);
    this.forward.y=0; this.forward.normalize();
    this.right.crossVectors(this.forward,Y).normalize();
    const points=sites.slice(0,3);
    const centre=new THREE.Vector3();
    for (const p of points) centre.add(new THREE.Vector3(p.x,0,p.z));
    centre.multiplyScalar(1/Math.max(1,points.length));
    this.field.position.copy(centre);
    let radius=130;
    for (const p of points) radius=Math.max(radius,Math.hypot(p.x-centre.x,p.z-centre.z)+85);
    const position=this.fieldGeometry.attributes.position;
    for (let i=0;i<position.count;i++) {
      const x=this.baseGrid[i*3]*radius*2,z=this.baseGrid[i*3+2]*radius*2;
      position.setXYZ(i,x,this.heightAt(x+centre.x,z+centre.z)+.12,z);
    }
    position.needsUpdate=true;
    this.fieldGeometry.computeBoundingSphere();
    points.forEach((p,i)=>{
      this.sources[i].value.set(p.x-centre.x,0,p.z-centre.z);
      this.strengths[i].value=.65+(p.coherence??.7)*.35;
      this.markers[i].position.set(p.x,this.heightAt(p.x,p.z),p.z);
    });
    this.update(now);
  }
  update(now) {
    if(!this.active) return;
    const seconds=Math.max(0,(now-this.t0)/1000);
    this.elapsed=seconds;
    this.time.value=seconds;
    this.energy.value=ease((seconds-20)/9);
    for (let i=0;i<this.ships.length;i++) {
      const arrival=ease((seconds-ARRIVALS[i].start)/ARRIVALS[i].duration);
      const portrait=this.camera.aspect<1;
      const distance=THREE.MathUtils.lerp(3600+i*380,(245+i*115)*(portrait?1.7:1),arrival);
      // Parallel world-space lanes share one projective vanishing point.
      // Fixed lateral offsets and altitude let perspective produce the spread.
      this.ships[i].position.copy(this.origin).addScaledVector(this.forward,distance)
        .addScaledVector(this.right,LANES[i]*(portrait?.65:1));
      this.ships[i].position.y=this.origin.y+100+i*34;
      this.ships[i].rotation.set(0,Math.atan2(-this.forward.z,this.forward.x),0);
      this.ships[i].visible=seconds>=ARRIVALS[i].start;
    }
    for (const marker of this.markers) marker.scale.y=.02+.98*ease((seconds-20)/10);
    this.field.visible=seconds>=20;
    this.markers.forEach(marker=>marker.visible=seconds>=20);
    const lift=ease((seconds-3)/23);
    this.destination.copy(this.origin).addScaledVector(this.forward,-12);
    this.destination.y=this.origin.y+18;
    this.camera.position.lerpVectors(this.startPosition,this.destination,lift);
    this.camera.position.y=Math.max(this.camera.position.y,this.heightAt(this.camera.position.x,this.camera.position.z)+1.1);
    this.aim.copy(this.origin).addScaledVector(this.forward,310);
    this.aim.y=this.origin.y+60;
    this.lookMatrix.lookAt(this.camera.position,this.aim,Y);
    this.targetRotation.setFromRotationMatrix(this.lookMatrix);
    this.camera.quaternion.slerpQuaternions(this.startQuaternion,this.targetRotation,lift);
    const fov=THREE.MathUtils.lerp(this.startFov,this.camera.aspect<1?72:58,lift);
    if(Math.abs(this.camera.fov-fov)>.001) {this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    this.camera.updateMatrixWorld(true);
  }
  reset() {
    this.active=false; this.group.visible=false; this.energy.value=0; this.elapsed=0;
  }
  snapshot() {
    return {active:this.active,seconds:this.elapsed,ships:this.ships.filter(s=>s.visible&&this.active).length,
      wave:this.energy.value,sources:3,tier:this.tier,vertices:this.fieldGeometry.attributes.position.count};
  }
}
