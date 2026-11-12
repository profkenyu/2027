/* Offline WebGL renderer. All exploration cameras remain on the rover mast. */
(function(root){
  'use strict';
  const V=root.Voyage,T=root.VoyageTHREE;
  const tiers=[{name:'LOW',segments:144,dpr:.8,shadow:0,fps:30},{name:'MID',segments:224,dpr:1.1,shadow:1024,fps:45},{name:'HIGH',segments:320,dpr:1.55,shadow:2048,fps:60}];
  const planetVertex=`varying vec3 vP;varying vec3 vN;void main(){vP=position;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const planetFragment=`
    varying vec3 vP;varying vec3 vN;uniform float uKind;uniform float uFocus;
    float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
    float f(vec3 p){return n(p)*.56+n(p*2.07)*.27+n(p*4.11)*.12+n(p*8.2)*.05;}
    void main(){vec3 p=normalize(vP);float a=f(p*5.+uKind*7.);float fine=f(p*34.);vec3 c;
      if(uKind<.5){float crack=pow(1.-abs(sin(p.x*18.+f(p*5.)*7.)),17.);c=mix(vec3(.24,.32,.34),vec3(.64,.70,.68),smoothstep(.26,.68,a));c*=1.-crack*.52;c+=fine*.12;}
      else if(uKind<1.5){c=mix(vec3(.16,.115,.075),vec3(.54,.37,.20),a);c*=.8+fine*.4;float basin=smoothstep(.76,.92,f(p*9.));c*=1.-basin*.4;}
      else {c=mix(vec3(.19,.24,.17),vec3(.48,.48,.31),a);c=mix(c,vec3(.43,.44,.32),.4);c+=sin(p.y*25.+f(p*4.)*11.)*.02;}
      vec3 light=normalize(vec3(-.8,.5,1.1));float diff=max(0.,dot(normalize(vN),light));float edge=pow(1.-max(0.,vN.z),3.);c*=.025+diff*.9;c+=vec3(.06,.08,.07)*edge*diff;c*=mix(.8,1.2,uFocus);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const skyVertex=`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const skyFragment=`varying vec3 vDirection;uniform vec3 uTop;uniform vec3 uHorizon;uniform vec3 uSun;void main(){vec3 d=normalize(vDirection);float horizon=exp(-max(d.y,0.)*5.);vec3 c=mix(uTop,uHorizon,horizon);float sun=pow(max(0.,dot(d,normalize(uSun))),18000.);c+=vec3(.9,.77,.51)*sun*.95;gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`.replace(';#include',';\n#include');

  class ArtworkRenderer{
    constructor(host){
      this.host=host;this.width=innerWidth;this.height=innerHeight;this.lookYaw=0;this.lookPitch=0;this.tilt=0;this.roll=0;
      this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const requested=['low','mid','high'].indexOf((new URLSearchParams(location.search).get('quality')||'').toLowerCase());
      this.auto=requested<0;
      this.level=requested>=0?requested:(matchMedia('(pointer:coarse)').matches?0:(navigator.hardwareConcurrency||8)<=6?1:2);
      this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'default'});
      this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
      this.renderer.shadowMap.enabled=!!tiers[this.level].shadow;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
      this.shaderFailed=false;
      if(this.renderer.debug)this.renderer.debug.onShaderError=()=>{this.shaderFailed=true;};
      host.appendChild(this.renderer.domElement);this.canvas=this.renderer.domElement;
      this.camera=new T.PerspectiveCamera(57,this.width/this.height,.08,1800);
      this.scene=null;this.phase='select';this.resources=[];this.target=new T.Vector3();
      this.setSize();this.showSelection();
    }
    setSize(){
      this.width=innerWidth;this.height=innerHeight;const t=tiers[this.level];
      const pixelBudget=3900000,cap=Math.sqrt(pixelBudget/(this.width*this.height));
      this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,t.dpr,cap));this.renderer.setSize(this.width,this.height,false);
      this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();
      if(this.phase==='select')this.layoutPlanets();
    }
    track(object){this.resources.push(object);return object;}
    material(C,options){return this.track(new C(options));}
    geometry(g){return this.track(g);}
    release(resource){const i=this.resources.indexOf(resource);if(i>=0)this.resources.splice(i,1);resource.dispose();}
    disposeScene(){
      for(const r of this.resources)r.dispose();this.resources=[];
      this.key?.shadow?.dispose();
      this.key=null;this.terrainMesh=null;this.groundGeometry=null;this.renderer.renderLists.dispose();
    }
    showSelection(){
      this.disposeScene();this.phase='select';this.scene=new T.Scene();this.scene.background=new T.Color('#080a09');
      this.camera.fov=42;this.camera.up.set(0,1,0);this.camera.position.set(0,0,12);this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();
      const geom=this.geometry(new T.SphereGeometry(1,64,48));
      this.planets=V.worlds.map((p,i)=>{
        const mat=this.material(T.ShaderMaterial,{vertexShader:planetVertex,fragmentShader:planetFragment,uniforms:{uKind:{value:i},uFocus:{value:0}}});
        const mesh=new T.Mesh(geom,mat);mesh.rotation.z=[.23,-.15,.1][i];this.scene.add(mesh);return mesh;
      });this.focus=-1;this.layoutPlanets();
    }
    layoutPlanets(){
      if(!this.planets)return;
      const vh=2*Math.tan(this.camera.fov*Math.PI/360)*12,vw=vh*this.width/this.height;
      const cy=this.width<=800?.415:.465;
      this.planets.forEach((m,i)=>{
        const x=(this.width<=800?[.192,.5,.808]:[.1967,.5,.8033])[i];
        m.position.set((x-.5)*vw,(.5-cy)*vh,0);
        const radius=Math.min(vw*(this.width<=800?.092:.075),vh*.15);
        m.scale.setScalar(radius);
      });
    }
    enter(p){
      this.disposeScene();this.phase='survey';this.p=p;this.planets=null;this.scene=new T.Scene();this.scene.background=new T.Color(p.sky);
      this.lookYaw=this.lookPitch=this.tilt=this.roll=0;this.camera.fov=57;this.camera.updateProjectionMatrix();
      this.groundGeometry=this.createGround(p);
      this.uniforms={uFogColor:{value:new T.Color(p.haze)},uFog:{value:p.fog},uEye:{value:new T.Vector3()},uRover:{value:new T.Vector3()},uForward:{value:new T.Vector3(0,0,-1)},uLamp:{value:0},uKind:{value:p.kind}};
      const terrainMat=this.material(T.MeshStandardMaterial,{vertexColors:true,roughness:.98,metalness:.015});
      this.prepareTerrainMaterial(terrainMat);
      this.terrainMesh=new T.Mesh(this.groundGeometry,terrainMat);this.terrainMesh.castShadow=true;this.terrainMesh.receiveShadow=true;this.scene.add(this.terrainMesh);
      const rockGeo=this.geometry(new T.SphereGeometry(1,7,5));
      const rp=rockGeo.attributes.position;
      for(let i=0;i<rp.count;i++){const f=.83+.31*V.hash(i,0,p.seed);rp.setXYZ(i,rp.getX(i)*f,rp.getY(i)*f,rp.getZ(i)*f);}rockGeo.computeVertexNormals();
      const rockMat=this.material(T.MeshStandardMaterial,{color:p.kind===0?'#8b9794':p.ground,roughness:1});this.prepareTerrainMaterial(rockMat);
      for(const r of V.obstacles(p)){
        const mesh=new T.Mesh(rockGeo,rockMat);mesh.position.set(r.x,r.y+r.size*.23,r.z);mesh.scale.set(r.size,p.kind===0?r.size*.27:r.size*.64,r.size*.85);mesh.rotation.y=r.angle;mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);
      }
      this.skyUniforms={uTop:{value:new T.Vector3(...p.skyColor)},uHorizon:{value:new T.Vector3(...p.horizonColor)},uSun:{value:new T.Vector3(-.8,.3,-.5)}};
      const skyMat=this.material(T.ShaderMaterial,{vertexShader:skyVertex,fragmentShader:skyFragment,uniforms:this.skyUniforms,side:T.DoubleSide,depthWrite:false});
      this.sky=new T.Mesh(this.geometry(new T.SphereGeometry(850,32,20)),skyMat);this.sky.renderOrder=-10;this.scene.add(this.sky);
      this.fill=new T.HemisphereLight(p.kind===0?0xa0b8bf:p.kind===1?0xb4a186:0xa1ad8c,0x141912,1.05);this.scene.add(this.fill);
      this.key=new T.DirectionalLight(0xffdfaa,2.5);this.key.castShadow=!!tiers[this.level].shadow;
      this.key.shadow.mapSize.setScalar(tiers[this.level].shadow||512);Object.assign(this.key.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:.1,far:240});
      this.key.shadow.normalBias=.18;this.key.shadow.bias=-.00012;this.scene.add(this.key,this.key.target);
    }
    createGround(p){
      const geo=this.geometry(new T.PlaneGeometry(1040,1040,tiers[this.level].segments,tiers[this.level].segments));geo.rotateX(-Math.PI/2);
      const pos=geo.attributes.position,colors=new Float32Array(pos.count*3),low=new T.Color(p.ground),high=new T.Color(p.high),rock=new T.Color(p.shadow),c=new T.Color();
      for(let i=0;i<pos.count;i++){
        pos.setY(i,V.height(pos.getX(i),pos.getZ(i),p));
      }
      pos.needsUpdate=true;geo.computeVertexNormals();
      // Use the actual mesh normals for slope tinting instead of evaluating
      // the terrain five additional times at every vertex during deployment.
      const normal=geo.attributes.normal;
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),z=pos.getZ(i),h=pos.getY(i),slope=Math.acos(V.clamp(normal.getY(i),0,1));
        const strata=Math.sin(h*2.4+V.noise(x*.03,z*.03,p.seed))*.055;
        c.copy(low).lerp(high,V.clamp(.22+h*.014+strata,0,.82)).lerp(rock,V.smooth(.25,.85,slope)*.6);
        if(p.kind===0&&Math.abs(x+22+9*Math.sin(z*.024)+4*Math.sin(z*.061))<3)c.lerp(rock,.6);
        c.toArray(colors,i*3);
      }
      geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      return geo;
    }
    prepareTerrainMaterial(material){
      const uniforms=this.uniforms;
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,uniforms);
        shader.vertexShader='varying vec3 vSurveyWorld;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvSurveyWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=`varying vec3 vSurveyWorld;uniform vec3 uFogColor;uniform float uFog;uniform vec3 uEye;uniform vec3 uRover;uniform vec3 uForward;uniform float uLamp;uniform float uKind;
          float surveyNoise(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
          `+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float grain=surveyNoise(floor(vSurveyWorld*90.));
          float sediment=sin(vSurveyWorld.y*13.+sin(vSurveyWorld.x*.2)+sin(vSurveyWorld.z*.15));
          diffuseColor.rgb*=.89+grain*.19+sediment*.045;
          float nearDetail=1.-smoothstep(12.,65.,distance(vSurveyWorld,uEye));
          diffuseColor.rgb*=1.-nearDetail*.12*pow(abs(sin(vSurveyWorld.x*4.+sin(vSurveyWorld.z*3.))),16.);
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          vec3 rel=vSurveyWorld-uRover;float len=length(rel.xz);float along=dot(normalize(rel.xz+vec2(.0001)),normalize(uForward.xz));
          float beam=smoothstep(.83,.97,along)*(1.-smoothstep(5.,28.,len))*smoothstep(0.,2.,len);
          totalEmissiveRadiance+=vec3(.36,.33,.24)*beam*uLamp;
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`float surveyFog=1.-exp(-pow(distance(vSurveyWorld,uEye)*uFog,1.28));gl_FragColor.rgb=mix(gl_FragColor.rgb,uFogColor,clamp(surveyFog,0.,.995));
          #include <tonemapping_fragment>`);
      };
      material.customProgramCacheKey=()=> 'survey-terrain-v1';
    }
    render(sim,dt,time){
      if(this.phase==='select'){
        this.planets.forEach((m,i)=>{if(!this.reduced)m.rotation.y=time*.015+i;m.material.uniforms.uFocus.value+=(Number(i===this.focus)-m.material.uniforms.uFocus.value)*.08;});
      }else if(sim){
        const s=sim.surface,speed=Math.abs(sim.speed),heading=sim.heading+this.lookYaw;
        const slopeForward=s.dx*(-Math.sin(sim.heading))+s.dz*(-Math.cos(sim.heading));
        const slopeSide=s.dx*Math.cos(sim.heading)-s.dz*Math.sin(sim.heading);
        const smooth=1-Math.exp(-dt*3);
        this.tilt+=(Math.atan(slopeForward)*.34-this.tilt)*smooth;this.roll+=(Math.atan(slopeSide)*.15-this.roll)*smooth;
        const vibration=this.reduced?0:Math.sin(sim.distance*7.2)*.012*speed;
        // The camera never leaves the mast. No chase, orbit, drone or flyover camera.
        const ground=Math.max(sim.y,this.meshGroundHeight(sim.x,sim.z));
        this.camera.position.set(sim.x,ground+1.42+vibration,sim.z);
        const pitch=this.lookPitch+this.tilt-.04;
        this.target.set(sim.x-Math.sin(heading)*20,ground+1.42+Math.tan(pitch)*20,sim.z-Math.cos(heading)*20);
        this.camera.up.set(Math.sin(this.roll),Math.cos(this.roll),0);this.camera.lookAt(this.target);
        this.sky.position.copy(this.camera.position);
        const light=sim.illumination;
        this.key.target.position.set(sim.x,sim.y,sim.z);this.key.position.set(sim.x+light.x*150,sim.y+light.y*150,sim.z+light.z*150);
        const day=V.clamp(light.y/.3,.18,1);this.key.intensity=2.5*day;this.fill.intensity=.65+day*.4;
        this.skyUniforms.uSun.value.set(light.x,light.y,light.z);
        this.skyUniforms.uTop.value.set(...this.p.skyColor).multiplyScalar(.5+day*.5);
        this.skyUniforms.uHorizon.value.set(...this.p.horizonColor).multiplyScalar(.6+day*.4);
        this.uniforms.uFogColor.value.setRGB(...this.p.horizonColor).multiplyScalar(.6+day*.4);
        this.uniforms.uEye.value.copy(this.camera.position);this.uniforms.uRover.value.set(sim.x,sim.y+1.1,sim.z);
        this.uniforms.uForward.value.set(-Math.sin(sim.heading),0,-Math.cos(sim.heading));this.uniforms.uLamp.value=sim.light?1:0;
      }
      this.renderer.render(this.scene,this.camera);
      if(this.shaderFailed)throw new Error('The rover optical shader could not be compiled.');
    }
    meshGroundHeight(x,z){
      const n=this.groundGeometry.parameters.widthSegments,cell=1040/n;
      const gx=(x+520)/cell,gz=(z+520)/cell,ix=V.clamp(Math.floor(gx),0,n-1),iz=V.clamp(Math.floor(gz),0,n-1),u=gx-ix,v=gz-iz;
      const pos=this.groundGeometry.attributes.position,a=iz*(n+1)+ix;
      const h00=pos.getY(a),h10=pos.getY(a+1),h01=pos.getY(a+n+1),h11=pos.getY(a+n+2);
      return u+v<=1?h00+(h10-h00)*u+(h01-h00)*v:h11+(h01-h11)*(1-u)+(h10-h11)*(1-v);
    }
    downgrade(){
      if(!this.auto||this.level===0)return false;this.level--;this.setSize();
      this.renderer.shadowMap.enabled=!!tiers[this.level].shadow;
      if(this.terrainMesh){
        const old=this.groundGeometry;this.groundGeometry=this.createGround(this.p);this.terrainMesh.geometry=this.groundGeometry;this.release(old);
      }
      if(this.key){
        this.key.shadow.dispose();this.key.shadow.map=null;this.key.shadow.mapPass=null;
        this.key.shadow.mapSize.setScalar(tiers[this.level].shadow||512);
        this.key.castShadow=!!tiers[this.level].shadow;this.key.shadow.needsUpdate=true;
        this.scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});
      }
      this.renderer.shadowMap.needsUpdate=true;
      return true;
    }
    get fps(){return tiers[this.level].fps;}
    get quality(){return tiers[this.level].name;}
  }
  V.ArtworkRenderer=ArtworkRenderer;
})(window);
