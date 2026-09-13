// Authored guidance envelopes, not inferred planetary gravity or orbital dynamics.
// Ground contact and the docking datum remain exact for every trajectory.
const PROFILES = Object.freeze({
  terra: Object.freeze({ key: 'terra', ignitionMs: 650, liftMs: 4750, descentMs: 5600, height: 32, lateral: [0, 0], brakePower: 1, camera: [-26, 17, 3], fov: 48 }),
  desert: Object.freeze({ key: 'desert', ignitionMs: 900, liftMs: 5700, descentMs: 7200, height: 29, lateral: [17.8, 2.46], brakePower: 1.18, camera: [-34, -23, 5], fov: 43 }),
  granite: Object.freeze({ key: 'granite', ignitionMs: 480, liftMs: 4400, descentMs: 6500, height: 42, lateral: [-5, 11], brakePower: 1.55, camera: [19, 24, 24], fov: 51 })
});
export const flightProfile = key => PROFILES[key] ?? PROFILES.terra;
