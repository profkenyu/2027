// Authored encounter, not an orbital solution. Integral of a positive speed
// curve: restrained departure, accelerating approach, short cosine braking.
export function approachProgress(progress) {
  const u=Math.max(0,Math.min(1,progress)),brake=.86,tail=1-brake;
  const coast=x=>.08*x+2*x*x*x/3;
  const speed=.08+2*brake*brake;
  const total=coast(brake)+speed*tail/2;
  if(u<=brake)return coast(u)/total;
  const q=(u-brake)/tail;
  return (coast(brake)+speed*tail*(q/2+Math.sin(Math.PI*q)/(2*Math.PI)))/total;
}
