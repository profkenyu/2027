// Sound is heard from an imagined instrument cabin, not through a vacuum.
export function createCabinAudio(response){
  let context,master,oscillator,gate,analyser,enabled=false,paused=false;
  function update(t){if(!context)return;const now=context.currentTime;
    const silence=t>=34&&t<42,fade=Math.min(1,t/5,Math.max(0,(64-t)/5));
    master.gain.setTargetAtTime(enabled&&!paused&&!silence?fade*.32:0,now,.12);
    oscillator.frequency.setTargetAtTime(response.toneHz,now,.3);
    gate.gain.setTargetAtTime(t<12||t>48?.16:.04,now,.3);
  }
  async function enable(){
    if(!context){context=new AudioContext();master=context.createGain();master.gain.value=0;master.connect(context.destination);analyser=context.createAnalyser();master.connect(analyser);
      gate=context.createGain();gate.connect(master);oscillator=context.createOscillator();oscillator.type='sine';oscillator.connect(gate);oscillator.start();
      const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=buffer.getChannelData(0);let b=0;
      for(let i=0;i<data.length;i++){b=(b+(Math.random()*2-1)*.025)/1.025;data[i]=b;}
      const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=155;filter.Q.value=.8;
      const gain=context.createGain();gain.gain.value=response.signalGain;source.connect(filter).connect(gain).connect(master);source.start();
    }
    enabled=true;await context.resume();
  }
  return {enable,update,mute(){enabled=false;update(0);},pause(){paused=true;context?.suspend();},resume(){paused=false;if(enabled)context?.resume();},get enabled(){return enabled;},snapshot(){return {enabled,state:context?.state??'locked',toneHz:response.toneHz,gain:master?.gain.value??0};},dispose(){context?.close();}};
}
