# Vehicle model verification

Run `npm run model` for the isolated WebGL fallback preview and kinematic
regressions at HIGH, MID, and LOW. Images are written to `dist/model-*.png`.
This checks 49 suspension positions, 101 leg-fold positions, damper overlap,
restoration visibility, open clamp clearance, the hull corridor, and feet on
sloped planes. It does not replace the artwork's WebGPU run.

Run `npm run build`, `npm run verify`, and `npm run smoke:sequence` after model
or docking changes. `npm run smoke:entry` checks fresh HTTP direct entry and
link entry in a touch-emulated 390 × 844 viewport, followed by reload.
Physical handheld GPU and touch acceptance remains a separate check.

## Model contracts

- Rover contact positions and eight-wheel drive remain owned by `Rover.update`.
  Two equal 0.34-unit links solve the visual suspension at those contacts.
  The damper uses two rigid overlapping members; no spring mesh is stretched.
- Lander upper links retain their lengths. Three overlapping 1.3-unit sleeves
  provide lower-leg reach. The radial-plane inverse-kinematics solution follows
  the authored foot trajectory, with terrain reach and touchdown compression.
- Pad normals use central differences and are limited to 0.28 radians. They
  return towards level during folding. This is a terrain-contact approximation,
  not a rigid-body or stress simulation.
- Bay lanes are flush with the existing collision floor. The stage and hull
  underside leave a continuous rectangular corridor. Four jaws move in the
  existing `secure` phase and retract on placement/reset. Existing sequence
  timing, camera ownership, and drive-mode controls are preserved.
- Segment counts on the new mechanisms reduce with the existing quality tier.
  Link lengths, contact targets, and docking behavior are identical across tiers.

The two existing authored events—terrain traversal and vehicle recovery—supply
the motion. No additional light, camera animation, or interface is introduced.
