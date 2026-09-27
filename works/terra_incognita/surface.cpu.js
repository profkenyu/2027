import * as CPU from "../../engine/cpu/noise.js";
import { T, D, G, BH, BODY02_WATER_SITE } from "./spec.js";
import { cfg } from "../../engine/config.js";
function geologyNoise(x,z,oct,ridged=false) {
  const {lacunarity,gain}=cfg().lattice;
  let qx=.8*x-.6*z,qz=.6*x+.8*z,sum=0,amp=.5;
  for(let i=0;i<oct;i++) {
    const n=CPU.vnoise(qx,qz),r=1-Math.abs(n*2-1);
    sum+=(ridged?r*r:n)*amp;
    const nx=(.8*qx-.6*qz)*lacunarity+19.7;
    qz=(.6*qx+.8*qz)*lacunarity+19.7;qx=nx;amp*=gain;
  }
  return sum/CPU.fbmNorm(oct,gain);
}
const geologyCPU={...CPU,fbm:(x,z,n)=>geologyNoise(x,z,n),ridge:(x,z,n)=>geologyNoise(x,z,n,true)};
let worldMix = 0;
let graniteMix = 0;
export function setCPUWorldMix(value) {
  const mode = typeof value === "string" ? value : value === 2 ? "granite" : value === 1 ? "desert" : "terra";
  worldMix = mode === "desert" ? 1 : 0;
  graniteMix = mode === "granite" ? 1 : 0;
}
export function desertHeightCPU(x, z) {
  const CPU = geologyCPU;
  const u = x * D.windCos + z * D.windSin;
  const v = x * -D.windSin + z * D.windCos;
  const regional = CPU.fbm(x * D.macroFreq + 93.7, z * D.macroFreq + 93.7, 3);
  const warpN = CPU.fbm(u * 22e-4 + 17.1, v * 85e-5 + 17.1, 2);
  const strata = CPU.ridge(u * D.yardangU + 63.4, v * D.yardangV + 63.4, 2);
  const skin = CPU.fbm(x * 0.045 + 5.8, z * 0.045 + 5.8, 2);
  const phase = (u + (warpN - 0.5) * D.warpAmp + Math.sin(v * 48e-4) * 12) * Math.PI * 2 / D.duneLambda;
  const wave = 0.72 * Math.sin(phase) + 0.2 * Math.sin(phase * 2 - 0.7) + 0.08 * Math.sin(phase * 3 - 1.1);
  const amp = D.duneAmpLo + (D.duneAmpHi - D.duneAmpLo) * CPU.smoothstep(0.26, 0.74, regional);
  const contour = Math.abs(regional - 0.43);
  const wadiNatural = 1 - CPU.smoothstep(0.028, 0.105, contour);
  const along = 0.181 * x + 0.983 * z;
  const archiveDist = Math.abs(along - 365 + (warpN - 0.5) * 42);
  const wadiRoute = (1 - CPU.smoothstep(16, 54, archiveDist)) * 0.88;
  const wadi = Math.max(wadiNatural, wadiRoute);
  const bed = Math.max(
    1 - CPU.smoothstep(0.014, 0.045, contour),
    1 - CPU.smoothstep(8, 22, archiveDist)
  );
  const rock = CPU.smoothstep(0.72, 0.89, strata + wadi * 0.1);
  const dune = wave * amp * (1 - 0.88 * wadi) * (1 - 0.65 * rock);
  const yardang = Math.pow(strata, D.yardangExp) * D.yardangAmp * (1 - 0.72 * wadi);
  const [ax, az, arx, arz, ah] = D.mesaA;
  const [bx, bz, brx, brz, bh] = D.mesaB;
  const ellA = Math.hypot(
    (x - ax + (warpN - 0.5) * 22) / arx,
    (z - az + (regional - 0.5) * 14) / arz
  );
  const ellB = Math.hypot(
    (x - bx - (warpN - 0.5) * 18) / brx,
    (z - bz + (regional - 0.5) * 12) / brz
  );
  const mesaA = (1 - CPU.smoothstep(0.72, 1.08, ellA)) * ah;
  const mesaB = (1 - CPU.smoothstep(0.74, 1.1, ellB)) * bh;
  const waterDistance = Math.hypot(x - BODY02_WATER_SITE.x, z - BODY02_WATER_SITE.z);
  const waterLens = 1 - CPU.smoothstep(
    BODY02_WATER_SITE.visual.coreRadius,
    BODY02_WATER_SITE.visual.haloRadius,
    waterDistance
  );
  return (regional - 0.5) * 5.5 + dune - wadi - bed * 0.65 + yardang + rock * (0.45 + 1.35 * skin) + mesaA + mesaB - waterLens * BODY02_WATER_SITE.visual.reliefDepth + (skin - 0.5) * 0.18 * (1 - 0.75 * rock);
}
export function graniteHeightCPU(x, z) {
  const CPU = geologyCPU;
  const macro = (CPU.fbm(x * G.macroFreq + 141.7, z * G.macroFreq + 141.7, G.macroOct) - 0.5) * G.macroAmp;
  const shelf = Math.pow(CPU.ridge(
    x * G.shelfFreq + 26.3,
    z * G.shelfFreq + 26.3,
    G.shelfOct
  ), G.shelfExp) * G.shelfAmp - G.shelfAmp * 0.3;
  const domeSource = CPU.fbm(x * G.domeFreq + 219.4, z * G.domeFreq + 219.4, G.domeOct);
  const dome = CPU.smoothstep(G.domeLo, G.domeHi, domeSource);
  const weather = (CPU.fbm(
    x * G.weatherFreq + 57.8,
    z * G.weatherFreq + 57.8,
    G.weatherOct
  ) - 0.5) * G.weatherAmp * (0.55 + dome * 0.45);
  const fractureField = CPU.fbm(x * .026 + 311.8, z * .026 + 311.8, 3);
  const exposure = CPU.smoothstep(.44, .64, CPU.fbm(x * .011 + 73.2, z * .011 + 73.2, 2));
  const joints = (1 - CPU.smoothstep(.006, .042, Math.abs(fractureField - .49))) * exposure * .38;
  const torSource = CPU.fbm(x * G.torFreq + 404.2, z * G.torFreq + 404.2, G.torOct);
  const tor = CPU.smoothstep(G.torLo, G.torHi, torSource) * (0.38 + dome * 0.62);
  return macro + shelf + dome * G.domeAmp + weather + tor * G.torAmp - joints * G.jointDepth;
}
export function veff(r) {
  const rc = Math.max(r, BH.rs);
  return -BH.M / rc + BH.L2 * 0.5 / (rc * rc) - BH.M * BH.L2 / (rc * rc * rc);
}
export function heightCPU(x, z) {
  const wa = CPU.fbm(x * T.warpFreq + T.warpOffA, z * T.warpFreq + T.warpOffA, T.warpOct) - 0.5;
  const wb = CPU.fbm(x * T.warpFreq + T.warpOffB, z * T.warpFreq + T.warpOffB, T.warpOct) - 0.5;
  const qx = x + wa * T.warpAmp, qz = z + wb * T.warpAmp;
  const macro = (CPU.fbm(x * T.macroFreq + T.macroOff, z * T.macroFreq + T.macroOff, T.macroOct) - 0.5) * T.macroAmp;
  const spine = Math.pow(CPU.ridge(qx * T.ridgeFreq, qz * T.ridgeFreq, T.ridgeOct), T.ridgeExp) * T.ridgeAmp;
  const rubble = CPU.fbm(qx * T.rubbleFreq, qz * T.rubbleFreq, T.rubbleOct) * T.rubbleAmp;
  const shelf = Math.pow(CPU.fbm(qx * T.shelfFreq + T.shelfOff, qz * T.shelfFreq + T.shelfOff, T.shelfOct), 2.2) * T.shelfAmp;
  const basin = CPU.smoothstep(
    T.basinLo,
    T.basinHi,
    CPU.fbm(x * T.basinFreq + T.basinOff, z * T.basinFreq + T.basinOff, T.basinOct)
  ) * T.basinDepth;
  const grit = CPU.fbm(x * T.gritFreq + T.gritOff, z * T.gritFreq + T.gritOff, T.gritOct) * T.gritAmp;
  const r = Math.hypot(x, z);
  const well = veff(r) * BH.depth;
  const shearPhase = r * T.shearRadial + qx * T.shearX + qz * T.shearZ + wa * T.shearWarp;
  const shearWindow = CPU.smoothstep(120, 220, r) * (1 - CPU.smoothstep(680, 820, r));
  const lamina = Math.pow(Math.abs(Math.sin(shearPhase)), T.shearExp) * T.shearAmp * shearWindow;
  const outer = CPU.smoothstep(800, 1040, r);
  const core = macro + spine + rubble + shelf - basin + grit + well + lamina;
  const dunes = (CPU.fbm(x * 87e-4 + 71.3, z * 87e-4 + 71.3, 3) - 0.5) * 2.4 + (CPU.fbm(x * 0.021 + 14.8, z * 0.021 + 14.8, 2) - 0.5) * 0.55;
  const terra = core * (1 - outer) + dunes * outer;
  const desert = desertHeightCPU(x, z);
  const granite = graniteHeightCPU(x, z);
  return (terra * (1 - worldMix) + desert * worldMix) * (1 - graniteMix) + granite * graniteMix;
}
export const solarAccessCPU = (x, z) => {
  const terra = 1 - CPU.smoothstep(700, 800, Math.hypot(x, z));
  return terra * (1 - worldMix - graniteMix) + worldMix + graniteMix;
};
export function normalCPU(x, z, e = 0.35) {
  const dhdx = (heightCPU(x + e, z) - heightCPU(x - e, z)) / (2 * e);
  const dhdz = (heightCPU(x, z + e) - heightCPU(x, z - e)) / (2 * e);
  const len = Math.hypot(-dhdx, 1, -dhdz);
  return [-dhdx / len, 1 / len, -dhdz / len];
}
