import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = seed => () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296; };

export function createFleet(tier) {
  // Soft illustrated shading like the reference: broad pale faces, charcoal
  // recesses and gentle transitions across the machined bevels.
  const ramp=new THREE.DataTexture(new Uint8Array([88,88,88,255,118,118,118,255,178,178,178,255,219,219,219,255,250,250,250,255]),5,1,THREE.RGBAFormat);
  ramp.minFilter=ramp.magFilter=THREE.LinearFilter;ramp.generateMipmaps=false;ramp.needsUpdate=true;
  const toon=(color,extra={})=>new THREE.MeshToonMaterial({color,gradientMap:ramp,...extra});
  const armour=toon(0xe4e3df,{vertexColors:true});
  const steel=toon(0x777570),dark=toon(0x292a29),ivory=toon(0xf1f0ec);
  const glass=toon(0x8ca6a3,{emissive:0x758b79,emissiveIntensity:.35});
  const engine=toon(0x344a59,{emissive:0x517c8a,emissiveIntensity:.4});
  const box=new THREE.BoxGeometry(1,1,1),unitBox=box;
  const cylinder=new THREE.CylinderGeometry(1,1,1,tier==='low'?8:12);
  const matrix=new THREE.Matrix4(), quaternion=new THREE.Quaternion();
  const materialList=[steel,dark,ivory,glass,engine,toon(0x3bafae),toon(0xf2cc23),toon(0x7aa437),toon(0xb9cb78)];
  const create=(index)=>{
    const root=new THREE.Group();root.name=`ark-${index+1}`;
    const rand=rng(719+index*101), detail=0;
    const carrier=index===0, capsule=index===3;
    const profile= capsule ? [[-520,35,28],[-430,100,76],[-240,125,86],[70,125,86],[350,86,60],[520,18,18]] :
      [[-520,carrier?125:70,34],[-420,carrier?198:155,56],[-220,carrier?215:185,62],[80,carrier?180:122,47],[330,carrier?100:57,27],[525,carrier?38:10,12]];
    const meshParts=[],instances=materialList.map(()=>[]),pipes=[];
    const add=(m,x,y,z,sx,sy,sz,q=null)=>{
      matrix.compose(new THREE.Vector3(x,y,z),q||quaternion.identity(),new THREE.Vector3(sx,sy,sz));instances[m].push(matrix.clone());
    };
    const ring=(w,h)=>[[-w*.72,h], [w*.72,h],[w,h*.42],[w,-h*.45],[w*.67,-h],[-w*.67,-h],[-w,-h*.45],[-w,h*.42]];
    const facet=(a,b,t,v)=>{
      const w=THREE.MathUtils.lerp(a[1],b[1],t),h=THREE.MathUtils.lerp(a[2],b[2],t),r=ring(w,h);
      const k=Math.floor(v),f=v-k,p=r[k%8],q=r[(k+1)%8];
      return new THREE.Vector3(THREE.MathUtils.lerp(p[0],q[0],f),THREE.MathUtils.lerp(p[1],q[1],f),THREE.MathUtils.lerp(a[0],b[0],t));
    };
    // Closed bevelled plates. Their face normals catch real grazing illumination.
    const plate=(corners,colour,thickness)=>{
      const centre=corners.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(.25);
      const n=new THREE.Vector3().subVectors(corners[1],corners[0]).cross(new THREE.Vector3().subVectors(corners[3],corners[0])).normalize();
      if(n.dot(new THREE.Vector3(centre.x,centre.y,0))<0){corners.reverse();n.negate();}
      const p=[];
      for(const c of corners)p.push(...c.toArray());
      for(const c of corners)p.push(...c.clone().lerp(centre,.008).addScaledVector(n,thickness).toArray());
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
      g.setIndex([4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);
      const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();
      const colors=[],uvs=[];const color=new THREE.Color(colour);
      for(let i=0;i<flat.attributes.position.count;i++){colors.push(color.r,color.g,color.b);const p=flat.attributes.position;uvs.push(p.getZ(i)/90,(p.getX(i)+p.getY(i))/70);}
      flat.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));flat.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));meshParts.push(flat);
      return {centre,n};
    };
    for(let s=0;s<profile.length-1;s++){
      const a=profile[s],b=profile[s+1];
      for(let face=0;face<8;face++){
        plate([facet(a,b,0,face),facet(a,b,1,face),facet(a,b,1,face+1),facet(a,b,0,face+1)],0x313a3e,0);
        const rows=1;
        for(let col=0;col<detail+2;col++)for(let row=0;row<rows;row++){
          const u0=(col+.0025)/(detail+2),u1=(col+.9975)/(detail+2),v0=face+(row+.0035)/rows,v1=face+(row+.9965)/rows;
          const {centre,n}=plate([facet(a,b,u0,v0),facet(a,b,u1,v0),facet(a,b,u1,v1),facet(a,b,u0,v1)],0xf0efea,.35);
          // Habitation strips lie on the side walls rather than floating in space.
          if(face===2||face===6){
            const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),n);
            for(let j=0;j<3;j++)if(rand()>.3){const p=centre.clone().addScaledVector(n,1.9);p.z+=(j-1)*5;add(3,p.x,p.y,p.z,1.1,.65,.22,q);}
          }
        }
      }
    }
    // Armoured closure at each end, with a recessed forward navigation bay.
    for(const end of [profile[0],profile.at(-1)]){
      const shape=new THREE.Shape();ring(end[1],end[2]).forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
      const g=new THREE.ShapeGeometry(shape);g.translate(0,0,end[0]);const mesh=new THREE.Mesh(g,ivory);mesh.material=ivory;mesh.material.side=THREE.DoubleSide;root.add(mesh);
    }
    const levels=capsule?1:carrier?3:2;
    for(let l=0;l<levels;l++){
      const width=(carrier?162:112)-l*20,length=290-l*45,y=62+l*14,z=-200-l*19;
      add(2,0,y,z,width,12,length);
      add(1,0,y+5,z+length*.46,width*.91,5,6);
      for(let j=0;j<Math.floor(width/6);j++)if(j%4!==0)add(3,-width*.45+j*6,y+5,z+length*.46+3.2,2.5,.85,.25);

    }
    // Structural keel, docking recesses, tanks, radiator fins and service conduits.
    add(1,0,-54,-70,34,20,650);add(0,0,-66,-70,10,8,610);
    add(1,0,4,525,48,14,4);add(0,0,5,529,39,2,2);
    for(let j=0;j<7;j++)add(3,(j-3)*4.5,5,530.2,1.5,.6,.2);
    // One mast preserves the scale cue; repeated piping and rooftop blocks are removed.
    matrix.compose(new THREE.Vector3(0,120,-275),new THREE.Quaternion(),new THREE.Vector3(1,35,1));pipes.push(matrix.clone());
    // Hobbes RnD reference: broad machined bevels around a dark recessed face.
    // These are physical service/observation housings, not a screen-space HUD.
    const chamfer=(w,h,c)=>{
      const shape=new THREE.Shape();const p=[[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],[w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]];
      p.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return shape;
    };
    const housing=new THREE.ExtrudeGeometry(chamfer(48,82,8),{depth:5,bevelEnabled:true,bevelThickness:4,bevelSize:5,bevelSegments:1,steps:1});housing.rotateX(-Math.PI/2);
    const face=new THREE.ShapeGeometry(chamfer(39,71,6));face.rotateX(-Math.PI/2);
    for(let j=0;j<1;j++)for(const side of [-1,1]){
      const z=80+j*112,y=48-j*8,x=side*(66-j*15);
      const shell=new THREE.Mesh(housing,ivory);shell.position.set(x,y,z);shell.castShadow=shell.receiveShadow=true;root.add(shell);
      const inset=new THREE.Mesh(face,dark);inset.position.set(x,y+9.1,z);root.add(inset);
      add(8,x,y+9.25,z+2,29,.15,43);
      add(5,x-12,y+9.35,z-27,5,.15,4);
      add(7,x-4,y+9.35,z-27,5,.15,4);
      add(6,x+9,y+9.35,z-27,14,.15,3);
      add(1,x+7,y+9.4,z+3,.3,.1,33);
      add(2,x,y+9.35,z+29,19,.15,1.2);
    }
    const deployables=[];
    for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(side*95,74,-235);
      const radiator=new THREE.Mesh(new RoundedBoxGeometry(64,3,205,1,1),dark);radiator.position.x=side*33;radiator.castShadow=radiator.receiveShadow=true;pivot.add(radiator);
      const rails=new THREE.InstancedMesh(unitBox,steel,6);
      for(let j=0;j<6;j++){matrix.makeScale(61,.5,1);matrix.setPosition(side*33,2,-90+j*36);rails.setMatrixAt(j,matrix);}
      pivot.add(rails);root.add(pivot);deployables.push({pivot,side});
    }
    const nozzle=new THREE.CylinderGeometry(24,17,48,tier==='low'?16:32,1,true);nozzle.rotateX(Math.PI/2);
    const rim=new THREE.TorusGeometry(23.5,1.7,8,tier==='low'?20:40);
    const throat=new THREE.CircleGeometry(16,tier==='low'?16:32);
    for(const x of [-76,0,76]){
      const bell=new THREE.Mesh(nozzle,steel);bell.position.set(x,-4,-540);root.add(bell);
      const lip=new THREE.Mesh(rim,ivory);lip.position.set(x,-4,-564);root.add(lip);
      const core=new THREE.Mesh(throat,engine);core.rotation.y=Math.PI;core.position.set(x,-4,-521);root.add(core);
    }
    const geometry=mergeGeometries(meshParts);meshParts.forEach(g=>g.dispose());
    const body=new THREE.Mesh(geometry,armour);body.castShadow=body.receiveShadow=true;root.add(body);
    const wire=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,32),new THREE.LineBasicMaterial({color:0x484740,transparent:true,opacity:.22,depthWrite:false}));
    wire.name='structural-wireframe';root.add(wire);
    instances.forEach((list,i)=>{
      const mesh=new THREE.InstancedMesh(i===3?unitBox:box,materialList[i],list.length);
      list.forEach((m,j)=>mesh.setMatrixAt(j,m));mesh.castShadow=i!==3;mesh.receiveShadow=i!==3;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
    });
    const pipeMesh=new THREE.InstancedMesh(cylinder,steel,pipes.length);pipes.forEach((m,i)=>pipeMesh.setMatrixAt(i,m));pipeMesh.castShadow=pipeMesh.receiveShadow=true;pipeMesh.computeBoundingSphere();root.add(pipeMesh);
    root.userData={panels:meshParts.length,instances:instances.reduce((n,v)=>n+v.length,0),kind:carrier?'carrier':capsule?'habitat':'migration',deployables};
    return root;
  };
  return Array.from({length:5},(_,i)=>create(i));
}
