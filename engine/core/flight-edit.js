// Editorial time envelopes, not orbital dynamics. Seconds throughout.
export const easeEdit=x=>{x=Math.max(0,Math.min(1,x));return Math.max(0,Math.min(1,x*x*x*(x*(x*6-15)+10)));};
export function surfaceEdit(phase,elapsed,profile){
  const end=(profile.ignitionMs+profile.liftMs)/1000;
  if(phase==='departing')return {veil:1,audio:0,approach:0};
  if(phase==='lift')return {
    veil:easeEdit((elapsed-(end-1.4))/1.15),
    audio:1-easeEdit((elapsed-(end-2))/1.65),approach:0
  };
  if(phase==='descent')return {
    veil:1-easeEdit((elapsed-.12)/1.15),
    audio:easeEdit((elapsed-.25)/1.65),
    approach:1-easeEdit(elapsed/2.4)
  };
  return {veil:0,audio:1,approach:0};
}
export function passageEdit(t,cuts){
  const enter=1-easeEdit((t-.12)/1.65),exit=easeEdit((t-61.7)/2.05);
  return {
    // Brief cut cover, not a fade-to-black pause between moving shots.
    veil:Math.max(enter,exit,...cuts.map(c=>1-easeEdit(Math.abs(t-c)/.09))),
    // A quiet coast separates propulsion cues; tails reach zero before navigation.
    audio:easeEdit(t/3)*(1-easeEdit((t-60)/3.6))*(1-easeEdit((t-32)/2)+easeEdit((t-42)/2)),
    thrust:1-easeEdit((t-8)/4)+easeEdit((t-48)/4)
  };
}
