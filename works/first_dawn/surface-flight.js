import {SURFACE_AT,DURATION} from './timeline.js';

export const SURFACE_TRAVEL=500;
// Minimum-jerk displacement: zero velocity and acceleration at either end.
// A cinematic low pass; this is not a vehicle dynamics simulation.
export function surfaceProgress(seconds){
  const u=Math.max(0,Math.min(1,(seconds-SURFACE_AT)/(DURATION-SURFACE_AT)));
  return u*u*u*(10+u*(-15+6*u));
}
export const surfaceTrackX=progress=>850-120*progress;
// Keep the final close observation at its existing world coordinate.
export const surfaceTrackZ=progress=>1020+SURFACE_TRAVEL*(1-progress);
