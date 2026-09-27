// Shared editorial frame, in flight-world units. This is a match cut across
// omitted travel time, not a continuous orbit-to-ground physical simulation.
export function approachFrame(position, focus, aspect, passage, t = 64) {
  const portrait = aspect < 1;
  const p = Math.max(0, Math.min(1, (t - (passage === 2 ? 44 : 40)) / (passage === 2 ? 20 : 24))) * .5;
  if (passage === 2) {
    position.set(portrait ? -5 : -22, 15 + p * 12, 75 + p * 95);
    focus.set(portrait ? -18 : -46, 19, -150);
  } else {
    position.set(portrait ? 5 - p * 5 : 28 - p * 16, 12 + p * 8, 52 + p * 88);
    focus.set(portrait ? 14 + p * 8 : 14 + p * 35, 10, -90 - p * 110);
  }
  return portrait ? 66 : 46;
}
