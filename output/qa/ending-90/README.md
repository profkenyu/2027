# Ending / checkpoint / export review — 2026-09-14

Ending lasts 90 seconds. Shots: arrival 0–20, hull 20–45, surface 45–90. The lead ship is 1.6 scale; five staggered arrivals use an integrated positive velocity curve with accelerating approach and short smooth braking. The ground observer remains 1.7 above the surface. Exact final Korean copy is preserved.

Atmosphere uses single scattering in a spherical shell with exponential Rayleigh/aerosol densities and a sun-direction-dependent phase function; 16/12/8 integration samples for HIGH/MID/LOW. Solar slant columns and spectral transmittance compositing are approximations, and coefficients are authored for a fictional world. These are not measured planetary conditions or an orbital simulation. Concept reference: [GPU Gems 2, Accurate Atmospheric Scattering](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering).

Verified:

- `node tools/ending.mjs`: 36 rendered frames across HIGH/MID/LOW, 90-second clamp, 20/45-second cuts, fourfold-or-greater near approach speed compared with distant speed, distinct five-ship speeds, deterministic seek, final observer height, title timing, audio, replay, live playback/pause and isolated file entry. See report.json.
- Visually inspected distant horizon emergence, atmospheric limb, near hull and final surface views, including portrait.
- `node tools/checkpoint-browser.mjs`: actual manual drive / automatic save / reload, selected resource variants, resumed planet 2 surface mission and planet 3 observation progress, RESUME routing, JSON/CSV downloads, English archive and portrait layout.
- `node tools/checkpoint-export.mjs`: malformed data, quota failure, non-finite coordinates, image whitelisting, CSV formula escaping, monotonic approach and smooth braking.
- Build, static validation, mission-memory and observation tests, three-tier vehicle model and 36 docking cases passed.

Checkpoints are per-tab session data, saved at safe states every five seconds and on page exit. Mid-scan and flight animations restart from the previous safe state. JSON export includes acquired image data; CSV contains observation metadata. Import is not implemented.

Physical phone/GPU thermals and projection hardware were not tested.
