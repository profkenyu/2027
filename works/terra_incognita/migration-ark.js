import * as THREE from 'three';

// Solid, panelled arks: broad carrier, tapered migration ship and long capsule.
// Baked directional tones keep the same silhouettes on all quality tiers.
export function buildMigrationArk(index, tier) {
  const group=new THREE.Group();
  group.name=`migration-ark-${index+1}`;
  const positions=[], colours=[];
  const light=new THREE.Vector3(-.4,.85,-.35).normalize();
  const tint=new THREE.Color();
  const normal=new THREE.Vector3();
  const point=new THREE.Vector3();
  const transform=new THREE.Matrix4();
  const rotation=new THREE.Quaternion();
  const normalMatrix=new THREE.Matrix3();
  const box=new THREE.BoxGeometry(1,1,1);
  const cylinder=new THREE.CylinderGeometry(1,1,1,tier==='low'?12:24);
  const add=(geometry,x,y,z,sx,sy,sz,color=0x79838a,angle=0)=>{
    transform.compose(new THREE.Vector3(x,y,z),rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),angle),new THREE.Vector3(sx,sy,sz));
    normalMatrix.getNormalMatrix(transform);
    const g=geometry.index?geometry.toNonIndexed():geometry;
    const p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++) {
      point.fromBufferAttribute(p,i).applyMatrix4(transform);
      normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
      tint.setHex(color).multiplyScalar(.3+.7*Math.max(0,normal.dot(light)));
      positions.push(point.x,point.y,point.z); colours.push(tint.r,tint.g,tint.b);
    }
    if(g!==geometry) g.dispose();
  };
  const kind=index===0?'carrier':index===3?'capsule':'wedge';
  const profile=kind==='carrier'?
    [[-72,10,6],[-58,23,10],[-28,29,12],[20,27,11],[52,18,9],[67,11,7]]:
    kind==='wedge'? [[-82,1.5,2],[-60,6,5],[-18,13,8],[28,29,10],[55,23,8],[66,12,6]]:
    [[-72,2,2],[-65,10,8],[-48,15,12],[35,15,12],[60,10,8],[70,3,3]];
  const vertices=[],triangles=[];
  for(const [x,w,h] of profile) {
    for(let i=0;i<8;i++) {
      const a=(i+.5)*Math.PI/4;
      vertices.push(x,Math.sin(a)*h,Math.cos(a)*w);
    }
  }
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<8;i++){
    const a=j*8+i,b=j*8+(i+1)%8,c=(j+1)*8+i,d=(j+1)*8+(i+1)%8;
    triangles.push(a,c,b,b,c,d);
  }
  for(let i=1;i<7;i++) triangles.push(0,i,i+1,(profile.length-1)*8,(profile.length-1)*8+i+1,(profile.length-1)*8+i);
  const hull=new THREE.BufferGeometry();
  hull.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  hull.setIndex(triangles); hull.computeVertexNormals();
  add(hull,0,0,0,1,1,1,0x697780);
  const levels=kind==='carrier'?4:kind==='capsule'?0:2;
  for(let i=0;i<levels;i++) {
    add(box,29+i*3,10+i*3.2,0,42-i*7,3.2,25-i*4,0x899399);
  }
  if(kind!=='capsule') for(const z of [-5,0,5]) add(cylinder,42,kind==='carrier'?26:18,z,.3,z===0?12:7,.3,0x8e999e);
  // Inset armour follows each tapered hull face instead of floating box rows.
  for(let section=0;section<profile.length-1;section++) {
    const a=profile[section],b=profile[section+1];
    const columns=tier==='low'?3:tier==='mid'?6:9;
    const surface=(t,v)=>{
      const angle0=(Math.floor(v)+.5)*Math.PI/4,angle1=angle0+Math.PI/4;
      const f=v-Math.floor(v),w=THREE.MathUtils.lerp(a[1],b[1],t),h=THREE.MathUtils.lerp(a[2],b[2],t);
      return new THREE.Vector3(THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(Math.sin(angle0),Math.sin(angle1),f)*h,THREE.MathUtils.lerp(Math.cos(angle0),Math.cos(angle1),f)*w);
    };
    for(let c=0;c<columns;c++) {
      const t=(c+.5)/columns,x=THREE.MathUtils.lerp(a[0],b[0],t);
      const w=THREE.MathUtils.lerp(a[1],b[1],t),h=THREE.MathUtils.lerp(a[2],b[2],t);
      for(let face=0;face<8;face++) {
        const corners=[surface((c+.06)/columns,face+.045),surface((c+.94)/columns,face+.045),surface((c+.94)/columns,face+.955),surface((c+.06)/columns,face+.955)];
        const centre=corners.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(.25);
        const outward=new THREE.Vector3().subVectors(corners[1],corners[0]).cross(new THREE.Vector3().subVectors(corners[3],corners[0])).normalize();
        if(outward.dot(new THREE.Vector3(0,centre.y,centre.z))<0)outward.negate();
        const platePositions=[];
        for(const p of corners)platePositions.push(...p.clone().addScaledVector(outward,.06).toArray());
        for(const p of corners)platePositions.push(...p.clone().lerp(centre,.045).addScaledVector(outward,.32).toArray());
        const plate=new THREE.BufferGeometry();
        plate.setAttribute('position',new THREE.Float32BufferAttribute(platePositions,3));
        plate.setIndex([4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);
        plate.computeVertexNormals();
        add(plate,0,0,0,1,1,1,(c+face+section)%5===0?0x58636b:0x849095);plate.dispose();
      }
      if(c%2===0)for(const side of [-1,1]) {
        add(box,x,h*.925+.55,side*w*.32,2.8,.8,1.6,0x47555f);
        add(box,x,-h*.925-.6,side*w*.30,2.2,.8,1.8,0x35414c);
        // Recessed service banks and narrow longitudinal conduits.
        for(let rib=0;rib<3;rib++)add(box,x-.8+rib*.8,-h*.925-1.1,side*w*.30,.24,.2,1.3,0x8b969b);
      }
      add(box,x,h+.3,0,(b[0]-a[0])/columns-.7,1,2.5,0x35434e);
      add(box,x,-h-1.2,0,(b[0]-a[0])/columns-.5,1.9,4,0x283b46);
    }
  }
  const nozzle=new THREE.CylinderGeometry(4,2.6,8,tier==='low'?12:24,1,true);
  const throat=new THREE.CylinderGeometry(2.4,2.4,.3,tier==='low'?12:24);
  const rim=new THREE.TorusGeometry(3.9,.32,6,tier==='low'?12:24);rim.rotateY(Math.PI/2);
  for(const z of [-8,0,8]) {
    add(cylinder,64,0,z,4.6,5,4.6,0x58636b,Math.PI/2);
    add(nozzle,69,0,z,1,1,1,0x35424e,-Math.PI/2);
    add(throat,66,0,z,1,1,1,0x101a23,Math.PI/2);
    add(rim,73,0,z,1,1,1,0x9aa4a6);
  }
  nozzle.dispose();throat.dispose();rim.dispose();
  for(const side of [-1,1]) {
    add(box,19,-4,side*20,43,5,4,0x3b4a55);
    add(box,8,9,side*18,32,.55,.55,0xb1b6b5);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
  geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  material.polygonOffset=true;material.polygonOffsetFactor=1;material.polygonOffsetUnits=1;
  group.add(new THREE.Mesh(geometry,material));
  const wireGeometry=new THREE.EdgesGeometry(geometry,28);
  const wireMaterial=new THREE.LineBasicMaterial({color:0xa2b9c4,transparent:true,opacity:.24,depthWrite:false});
  const wire=new THREE.LineSegments(wireGeometry,wireMaterial);
  wire.name='migration-structural-wireframe';group.add(wire);
  // Sparse habitable windows, never a glowing outline of the entire vessel.
  const windows=new THREE.InstancedMesh(box,new THREE.MeshBasicMaterial({color:0xb8d9d8}),20);
  for(let i=0;i<20;i++) {
    transform.makeScale(.9,.32,.2);
    transform.setPosition(-5+(i%10)*3.1,-3,(i<10?-1:1)*22.1);
    windows.setMatrixAt(i,transform);
  }
  windows.instanceMatrix.needsUpdate=true;
  group.add(windows);
  group.userData.kind=kind;
  group.userData.dispose=()=>{
    geometry.dispose(); material.dispose(); wireGeometry.dispose();wireMaterial.dispose();windows.material.dispose(); box.dispose();
  };
  hull.dispose(); cylinder.dispose();
  return group;
}
