# Ending: cinematic fleet and accelerated surface approach — 2026-09-15

The geometry builder in the supplied `/Users/kenyu/Desktop/ending_sf.html` was inspected and adapted into `works/first_dawn/reference-ark.js`. The existing five ships remain. Exactly one additional ship has the reference's twin habitat rings, axial truss, pressure vessels, four nozzles and deployable radiator panels. The standalone reference file is not a runtime dependency.

## Timing

- 0–20 s: distant formation and planetary limb.
- 20–40 s: original lead ship close view.
- 40–68 s: the larger reference ark; a continuous fore-to-aft camera pass carries both rings across the frame.
- 68–108 s: a low surface approach, final formation and the original Korean closing line.

The arrival now begins with all six vessels already in distant flight. A continuous coast joins each authored approach with matching position and velocity, replacing timed visibility switches. The camera observes the actual formation distance with only 2 degrees of lens narrowing. Opening compositions at 0, 10 and 19 seconds were captured at desktop and portrait sizes; desktop 0/19 and portrait 10 were visually inspected. Browser checks across all three tiers verify continuous forward movement and six visible vessels on both sides of every former appearance time.

The surface camera travels 780 units forward (formerly 120) and 120 laterally. A quintic minimum-jerk curve accelerates to the middle of the shot and eases to rest at the end. Clearance descends from 8 to 5 units above the rendered terrain triangles. Fixed boulders beside the path and filtered sediment striations supply parallax. Warm direct light and cool reflected light distinguish illuminated hull panels from recessed structure. No additional render pass was introduced.

Perspective, occlusion and geometric shadows produce the size reveal. The shadow volume follows the observed vessel without rotating the solar light direction. Flight timing, scale and observer trajectory are artistic choices, not an orbital or artificial-gravity simulation. Existing atmospheric scattering remains a numerical approximation for a fictional planet.

## Verification

- `npm run build`, `npm run verify`, and all seven deployment SHA-256 checks passed.
- `npm run finale`: 19 sampled times per tier, 57 rendered frames; six total ships, five original ships and one reference ship; 108-second limit; camera phases; positive accelerated approach; distinct ship speeds; deterministic seek; radiator deployment; title timing; audio; replay; pause/resume; autonomous playback; isolated `file://` operation without source assets.
- Surface acceleration and late braking checked in the browser. Independent raycasts against the actual terrain mesh every 0.5 seconds across HIGH/MID/LOW confirm 5–8 units of clearance (243 checks).
- Visual inspection included wide arrival, original hull, the new ark at 41/48/54/67 seconds, and the surface tableau; portrait close-up and final composition also inspected.
- Maximum rendered triangles across samples, including shadow passes: HIGH 360,666; MID 288,830; LOW 214,514. These are geometry counts, not physical-device frame-rate measurements.
- HIGH/MID/LOW preserve the complete silhouette and choreography while reducing curved-surface segments, shadow-map resolution and pixel ratio. Physical phone thermals and projector output were not measured.

The full sampled-state results are in `report.json`. Three representative images are retained; `npm run finale` updates these without accumulating screenshots for every sampled time.
