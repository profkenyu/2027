# Planet page split QA — 2026-09-14

Passed:

- Build and static verification: three entry pages and identical shared engine in root, dist, works/terra_incognita; imports, boot order, HUD, fonts and archive.
- Native Chrome WebGPU, file entry: planet 01 → docking → transit → planet 02 → descent → rover deployment → docking → planet 03 → descent → rover deployment → ending → opening. No console errors. Route captures and states: ../planet-upgrade/route.json.
- HTTP direct entry and reload: planet 01 HIGH, planet 02 MID, planet 03 LOW. Correct world and stable universe seed.
- Cold planet 03 without prior observations: terrain and recovery link, no fabricated evidence. Screenshot: direct-03.png.
- Archive: English visible text, last planet return target.
- Opening and mission controls: light, camera rear/mast, AUTO/MANUAL, GREEN/RAW, audio start/mute/unmute, no overlap or horizontal overflow, zero console errors.
- Memory unit check: nonzero journey history survives controller reconstruction with identical generated sites and observation duration.
- Observation sequence and final alignment checks.

Browser tests ran in desktop Chrome. Physical phone, thermal behavior, projection hardware and a full unattended exhibition-duration run were not tested. Reload restarts the current planet's entry sequence; it is not an exact frame checkpoint.
