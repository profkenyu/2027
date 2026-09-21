import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {flightMaterial} from './surfaces.js';
import {SHOULDER_RADII} from '../../engine/vehicle/landing-gear-layout.js';

// Flight-only close-view finish on the existing service cells and engine bells.
// No changes to the silhouette, landing joints, or deployment mechanism.
export function addFlightDetails(group,tier){
  const silver=flightMaterial([.31,.33,.34],'metal'),foil=flightMaterial([.34,.23,.09],'foil'),dark=flightMaterial([.024,.03,.035],'graphite');
  const batches=new Map();
  function add(material,geometry,position,yaw=0){
    geometry.rotateY(yaw);geometry.translate(...position);
    const flat=geometry.index?geometry.toNonIndexed():geometry;
    flat.deleteAttribute('uv');if(flat!==geometry)geometry.dispose();
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push(flat);
  }
  const ribs=tier==='high'?10:tier==='mid'?7:4;
  for(const i of [0,1,3]){
    const a=i*Math.PI/2,segments=tier==='high'?32:tier==='mid'?20:12;
    const blanket=new THREE.PlaneGeometry(1.30,.78,segments,Math.max(6,segments/2)),p=blanket.attributes.position;
    for(let j=0;j<p.count;j++){
      const x=p.getX(j),y=p.getY(j),edge=Math.max(0,1-Math.pow(Math.abs(x)/.65,8))*Math.max(0,1-Math.pow(Math.abs(y)/.39,8));
      p.setZ(j,edge*(.009*Math.sin(x*31+Math.sin(y*19)*2)+.007*Math.sin(y*61+Math.sin(x*17)*1.6)));
    }
    blanket.computeVertexNormals();add(foil,blanket,[Math.sin(a)*3.116,1.9,Math.cos(a)*3.116],a);
    // Captive seam tape holds the insulation at the perimeter of the service cell.
    for(const x of [-.65,.65])add(silver,new THREE.BoxGeometry(.025,.80,.016),[Math.sin(a)*3.126+Math.cos(a)*x,1.9,Math.cos(a)*3.126-Math.sin(a)*x],a);
    for(const y of [1.51,2.29])add(silver,new THREE.BoxGeometry(1.32,.025,.016),[Math.sin(a)*3.126,y,Math.cos(a)*3.126],a);
  }
  // Cooling ridges and a dark recessed throat belong to the existing three bells.
  for(const [x,z] of [[-1.45,.1],[1.45,.1],[0,1.65]]){
    for(let i=0;i<ribs;i++){
      const u=i/(ribs-1),y=.49+u*.36,r=.445-u*.198;
      const ring=new THREE.TorusGeometry(r,.011,4,tier==='high'?24:tier==='mid'?20:12);ring.rotateX(Math.PI/2);add(silver,ring,[x,y,z]);
    }
    add(dark,new THREE.CylinderGeometry(.155,.155,.11,16),[x,.86,z]);
  }
  // Retainer rings around the existing landing-gear shoulder bearings.
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,ring=new THREE.TorusGeometry(.265,.022,6,tier==='low'?16:32);
    add(silver,ring,[Math.cos(a)*(SHOULDER_RADII[i]+.02),2.24,Math.sin(a)*(SHOULDER_RADII[i]+.02)],Math.PI/2-a);
  }
  for(const [material,geometries] of batches){
    const geometry=mergeGeometries(geometries);for(const g of geometries)g.dispose();
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name='flight-close-detail';group.add(mesh);
  }
}

// Recover the source's two-triangle hull tiles and give their exposed edges
// a small bevel. This follows existing panels instead of drawing another grid.
export function bevelHullTiles(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,positions=[],normals=[];
  const points=Array.from({length:6},()=>new THREE.Vector3()),normal=new THREE.Vector3(),center=new THREE.Vector3();
  const equal=(a,b)=>a.distanceToSquared(b)<1e-8;
  function triangle(a,b,c){
    const face=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
    for(const v of [a,b,c]){positions.push(v.x,v.y,v.z);normals.push(face.x,face.y,face.z);}
  }
  for(let i=0;i+5<p.count;i+=6){
    for(let j=0;j<6;j++)points[j].fromBufferAttribute(p,i+j);
    if(!equal(points[2],points[3])||!equal(points[1],points[4]))continue;
    const quad=[points[0],points[1],points[5],points[2]];
    if(quad.some(v=>v.y<3.06||v.y>5.5))continue;
    const lengths=quad.map((v,j)=>v.distanceTo(quad[(j+1)%4]));
    if(Math.min(...lengths)<.14||Math.max(...lengths)>1.85)continue;
    normal.fromBufferAttribute(n,i).normalize();center.set(0,0,0);for(const v of quad)center.add(v);center.multiplyScalar(.25);
    const outer=quad.map(v=>v.clone().addScaledVector(normal,.001));
    const inner=quad.map(v=>v.clone().sub(center).multiplyScalar(.96).add(center).addScaledVector(normal,.016));
    triangle(inner[0],inner[1],inner[3]);triangle(inner[3],inner[1],inner[2]);
    for(let j=0;j<4;j++){const k=(j+1)%4;triangle(outer[j],inner[j],outer[k]);triangle(inner[j],inner[k],outer[k]);}
  }
  if(!positions.length)return geometry;
  const bevel=new THREE.BufferGeometry();bevel.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));bevel.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  const merged=mergeGeometries([geometry,bevel]);geometry.dispose();bevel.dispose();merged.computeBoundingSphere();return merged;
}
