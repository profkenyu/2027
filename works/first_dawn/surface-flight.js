import {CUTS,DURATION} from './timeline.js';

export const SURFACE_TRAVEL=780;
// Minimum-jerk displacement: zero velocity and acceleration at either end.
// A cinematic low pass; this is not a vehicle dynamics simulation.
export function surfaceProgress(seconds){
  const u=Math.max(0,Math.min(1,(seconds-CUTS[2])/(DURATION-CUTS[2])));
  return u*u*u*(10+u*(-15+6*u));
}
export const surfaceTrackX=progress=>850-120*progress;
export const surfaceTrackZ=progress=>1800-SURFACE_TRAVEL*progress;
