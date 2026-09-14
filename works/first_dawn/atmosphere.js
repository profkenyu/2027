import * as THREE from 'three';

// Single-scattering approximation in a spherical shell. Density scale heights
// and coefficients are authored for this fictional world, not measured data.
export function createAtmosphere(planet,sun,tier){
  const steps={high:16,mid:12,low:8}[tier];
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.FrontSide,
    uniforms:{center:{value:planet.position.clone()},sun:{value:sun}},
    vertexShader:`varying vec3 worldPoint;void main(){vec4 p=modelMatrix*vec4(position,1.);worldPoint=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`
      precision highp float;
      varying vec3 worldPoint;uniform vec3 center;uniform vec3 sun;
      const float R=1.;const float A=1.0273;
      vec2 hit(vec3 o,vec3 d,float radius){float b=dot(o,d),c=dot(o,o)-radius*radius,k=b*b-c;if(k<0.)return vec2(1e6,-1e6);return vec2(-b-sqrt(k),-b+sqrt(k));}
      void main(){
        vec3 origin=(cameraPosition-center)/16500.,ray=normalize(worldPoint-cameraPosition);
        vec2 shell=hit(origin,ray,A),ground=hit(origin,ray,R);
        float begin=max(0.,shell.x),end=shell.y;
        if(ground.x>0.&&ground.x<end)end=ground.x;
        if(end<=begin)discard;
        float stride=(end-begin)/float(${steps});
        vec3 betaR=vec3(3.2,5.6,9.2),betaM=vec3(8.8,7.6,6.2);
        float mu=dot(ray,sun),phaseR=.059683*(1.+mu*mu),g=.68;
        float phaseM=.079577*(1.-g*g)/pow(max(.05,1.+g*g-2.*g*mu),1.5);
        vec3 optical=vec3(0.),scatter=vec3(0.);
        for(int i=0;i<${steps};i++){
          vec3 p=origin+ray*(begin+(float(i)+.5)*stride);
          float h=max(0.,length(p)-R);
          float rhoR=exp(-h/.006),rhoM=exp(-h/.0021);
          vec3 extinction=(betaR*rhoR+betaM*rhoM)*stride;
          float sunMu=dot(normalize(p),sun);
          // Curvature-limited slant column avoids a flat-atmosphere singularity.
          float column=1./sqrt(sunMu*sunMu+.025);
          vec3 sunDepth=(betaR*rhoR*.006+betaM*rhoM*.0021)*column;
          vec2 shadow=hit(p+normalize(p)*.00001,sun,R);
          float lit=shadow.x>0.&&shadow.y>0.?0.:1.;
          scatter+=exp(-optical-extinction*.5-sunDepth)*(betaR*rhoR*phaseR+betaM*rhoM*phaseM)*stride*lit;
          optical+=extinction;
        }
        float alpha=clamp(1.-exp(-dot(optical,vec3(.2126,.7152,.0722))),0.,.96);
        if(alpha<.0001)discard;
        gl_FragColor=vec4(scatter*5.5/max(alpha,.001),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const shell=new THREE.Mesh(new THREE.SphereGeometry(16950,tier==='low'?64:96,tier==='low'?40:64),material);
  shell.position.copy(planet.position);shell.name='single-scattering-atmosphere';
  return shell;
}
