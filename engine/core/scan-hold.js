// Enter the acquisition disc before braking. Once integrating, use the larger
// scan disc as hysteresis; never park outside the disc that starts a scan.
export function scanHold(probe, site, integrating = false) {
  if (!probe || !site) return false;
  const radius = integrating ? site.scanRadius : Math.max(0, site.acquireRadius - .2);
  return Math.hypot(probe.x - site.x, probe.z - site.z) <= radius;
}
