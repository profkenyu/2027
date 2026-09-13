import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = seed => () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296; };

export function createFleet(tier) {
  // Physical surface response: ceramic shielding, recessed metal and MLI.
  const toon=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.18,...extra});
  const armour=toon(0xb9bec0,{vertexColors:true});
  const steel=toon(0x687278,{metalness:.72,roughness:.46}),dark=toon(0x171e23),ivory=toon(0xd6d5cd);
  const glass=toon(0x172a31,{metalness:.6,roughness:.22,emissive:0xabc7cc,emissiveIntensity:.12});
  const engine=toon(0x15252b,{emissive:0x527988,emissiveIntensity:.16});
  const box=new RoundedBoxGeometry(1,1,1,1,.055),unitBox=new THREE.BoxGeometry(1,1,1);
  const cylinder=new THREE.CylinderGeometry(1,1,1,tier==='low'?8:12);
  const matrix=new THREE.Matrix4(), quaternion=new THREE.Quaternion();
  const materialList=[steel,dark,ivory,glass,engine,toon(0x968266,{metalness:.65}),toon(0xa28e6b),toon(0x4a555b),toon(0x253238)];
  const create=(index)=>{
    const root=new THREE.Group();root.name=`ark-${index+1}`;
    const rand=rng(719+index*101), detail=tier==='high'?5:tier==='mid'?3:1;
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
        const rows=tier==='low'?1:2;
        for(let col=0;col<detail+2;col++)for(let row=0;row<rows;row++){
          const u0=(col+.0025)/(detail+2),u1=(col+.9975)/(detail+2),v0=face+(row+.0035)/rows,v1=face+(row+.9965)/rows;
          const {centre,n}=plate([facet(a,b,u0,v0),facet(a,b,u1,v0),facet(a,b,u1,v1),facet(a,b,u0,v1)],new THREE.Color().setScalar(.73+rand()*.2),.65);
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
    const levels=capsule?1:2;
    for(let l=0;l<levels;l++){
      const width=(carrier?126:92)-l*30,length=210-l*75,y=67+l*23,z=-240-l*28;
      add(2,0,y,z,width,16,length);
      add(1,0,y+5,z+length*.46,width*.91,5,6);
      for(let j=0;j<Math.floor(width/6);j++)if(j%4!==0)add(3,-width*.45+j*6,y+5,z+length*.46+3.2,2.5,.85,.25);

    }
    // Structural keel, docking recesses, tanks, radiator fins and service conduits.
    add(1,0,-54,-70,34,20,650);add(0,0,-66,-70,10,8,610);
    add(1,0,4,525,48,14,4);add(0,0,5,529,39,2,2);
    for(let j=0;j<7;j++)add(3,(j-3)*4.5,5,530.2,1.5,.6,.2);
    // Pressure vessels sit above a recessed service deck, joined by actual
    // beams. Repetition expresses habitation capacity rather than surface noise.
    const beam=(a,b,r=1.6)=>{
      const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
      matrix.compose(av.add(bv).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()),new THREE.Vector3(r,d.length(),r));pipes.push(matrix.clone());
    };
    const pressure=new THREE.CapsuleGeometry(12,42,tier==='low'?2:4,tier==='low'?8:12);pressure.rotateX(Math.PI/2);
    for(const side of [-1,1]){
      for(let j=0;j<5;j++){
        const z=-340+j*100,x=side*(carrier?139:95),y=64-j*4;
        const pod=new THREE.Mesh(pressure,ivory);pod.position.set(x,y,z);pod.castShadow=pod.receiveShadow=true;root.add(pod);
        add(1,x,y-12,z,31,5,75);
        for(const dz of [-19,19])add(0,x,y+11,z+dz,24,2,3);
        beam([x,y-16,z-43],[x,y-16,z+43],2);
        beam([x,y-16,z-43],[x,y+8,z],1.2);
        add(5,x,y+5,z+34,13,11,6);
      }
    }
    // An elevated, narrow observation bridge recalls the supplied silhouette.
    add(0,0,126,-295,29,98,38);add(2,0,170,-290,128,19,49);
    add(1,0,171,-264,117,9,2);
    for(let j=-5;j<=5;j++)add(3,j*10,172,-262.8,6,3,.5);
    beam([-45,181,-290],[-45,208,-290],1);beam([40,181,-290],[40,208,-290],1);
    const dish=new THREE.Mesh(new THREE.SphereGeometry(12,12,6,0,Math.PI*2,0,.9),steel);dish.rotation.x=Math.PI/2;dish.position.set(40,198,-290);root.add(dish);
    // Two recessed maintenance corridors follow the changing hull section.
    // Cross-bracing is tied to the deck slope, never randomly scattered greeble.
    for(const side of [-1,1])for(let j=0;j<8;j++){
      const z=-90+j*64;
      const k=profile.findIndex((v,i)=>i<profile.length-1&&z>=v[0]&&z<profile[i+1][0]);
      const a=profile[k],b=profile[k+1],t=(z-a[0])/(b[0]-a[0]);
      const h=THREE.MathUtils.lerp(a[2],b[2],t),w=THREE.MathUtils.lerp(a[1],b[1],t);
      const slope=Math.atan2(b[2]-a[2],b[0]-a[0]);
      const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-slope);
      const x=side*w*.43;
      add(1,x,h+.4,z,Math.max(7,w*.13),1.2,57,q);
      add(0,x,h+1.3,z,2,1.3,51,q);
      for(const dz of [-20,20])add(2,x,h+2-dz*Math.sin(-slope),z+dz,Math.max(8,w*.14),1.2,2,q);
    }
    // Twin longitudinal service cuts and keel ribs read during a close pass.
    for(const side of [-1,1]){
      add(1,side*34,-54,90,8,7,540);
      for(let j=0;j<9;j++)add(0,side*43,-58,-180+j*55,24,3,2);
      for(let j=0;j<4;j++){
        const z=-355+j*66;
        add(1,side*70,-60,z,47,12,49);add(0,side*70,-67,z,38,2,39);
      }
    }
    const collar=new THREE.Mesh(new THREE.TorusGeometry(20,4,6,20),steel);collar.rotation.x=Math.PI/2;collar.position.set(0,-73,105);root.add(collar);
    const hatch=new THREE.Mesh(new THREE.CylinderGeometry(17,17,6,20),dark);hatch.position.set(0,-73,105);root.add(hatch);
    const deployables=[];
    for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(side*(carrier?203:165),4,-250);
      const radiator=new THREE.Mesh(new RoundedBoxGeometry(116,3,330,1,1),dark);radiator.position.x=side*60;radiator.castShadow=radiator.receiveShadow=true;pivot.add(radiator);
      const rails=new THREE.InstancedMesh(unitBox,steel,10);
      for(let j=0;j<10;j++){matrix.makeScale(111,.8,1.2);matrix.setPosition(side*60,2,-148+j*33);rails.setMatrixAt(j,matrix);}
      pivot.add(rails);root.add(pivot);deployables.push({pivot,side});
    }
    const nozzle=new THREE.CylinderGeometry(17,24,48,tier==='low'?16:32,1,true);nozzle.rotateX(Math.PI/2);
    const rim=new THREE.TorusGeometry(23.5,1.7,8,tier==='low'?20:40);
    const throat=new THREE.CircleGeometry(16,tier==='low'?16:32);
    for(const x of [-76,0,76]){
      const bell=new THREE.Mesh(nozzle,steel);bell.position.set(x,-4,-540);root.add(bell);
      const lip=new THREE.Mesh(rim,ivory);lip.position.set(x,-4,-564);root.add(lip);
      const core=new THREE.Mesh(throat,engine);core.rotation.y=Math.PI;core.position.set(x,-4,-521);root.add(core);
    }
    // Brief paired attitude jets; opposite ends create a couple.
    const jets=[];
    const jetMaterial=new THREE.MeshBasicMaterial({color:0xbcdce3,transparent:true,opacity:.24,depthWrite:false});
    for(const [x,z,sign] of [[150,-390,1],[-55,310,-1]]){
      add(0,x,0,z,8,9,12);
      const jet=new THREE.Mesh(new THREE.ConeGeometry(3.5,29,6),jetMaterial);
      jet.rotation.z=sign*Math.PI/2;jet.position.set(x+sign*17,0,z);jet.visible=false;root.add(jet);jets.push(jet);
    }
    const geometry=mergeGeometries(meshParts);meshParts.forEach(g=>g.dispose());
    const body=new THREE.Mesh(geometry,armour);body.castShadow=body.receiveShadow=true;root.add(body);
    const wire=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,32),new THREE.LineBasicMaterial({color:0x171d22,transparent:true,opacity:.16,depthWrite:false}));
    wire.name='structural-wireframe';root.add(wire);
    instances.forEach((list,i)=>{
      const mesh=new THREE.InstancedMesh(i===3?unitBox:box,materialList[i],list.length);
      list.forEach((m,j)=>mesh.setMatrixAt(j,m));mesh.castShadow=i!==3;mesh.receiveShadow=i!==3;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
    });
    const pipeMesh=new THREE.InstancedMesh(cylinder,steel,pipes.length);pipes.forEach((m,i)=>pipeMesh.setMatrixAt(i,m));pipeMesh.castShadow=pipeMesh.receiveShadow=true;pipeMesh.computeBoundingSphere();root.add(pipeMesh);
    root.userData={panels:meshParts.length,instances:instances.reduce((n,v)=>n+v.length,0),jets,kind:carrier?'carrier':capsule?'habitat':'migration',deployables};
    return root;
  };
  return Array.from({length:5},(_,i)=>create(i));
}
