import * as Tone from 'tone';
import {DURATION,CUTS} from './timeline.js';

// Deep Space Resonance: an authored acoustic interpretation, not sound in vacuum.
// Visual time owns the score; Web Audio owns continuous oscillation and envelopes.
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const fade=(t,a,b)=>1-smooth((t-a)/(b-a));
const TIERS={high:{decay:20,extra:true},mid:{decay:16,extra:false},low:{decay:12,extra:false}};
export function soundScore(t,distance=12000){
  return {
    high:smooth((t-12)/20)*fade(t,64,70),
    mid:smooth((t-8)/18)*fade(t,66,74),
    drone:smooth((t-1)/18)*fade(t,68,78),
    wind:smooth((t-CUTS[2])/5)*fade(t,98,108)*(.36+.64*Math.sin(Math.PI*Math.max(0,Math.min(1,(t-68)/40)))),
    floor:smooth(t/20)*fade(t,103,DURATION)*(1-.75*smooth((t-68)/8)),
    proximity:1/(1+Math.max(0,distance)/4500),
    phase:t>=DURATION?'silence':t>=68?'surface-wind':t>=64?'surface-crossfade':'resonance'
  };
}

export function createDeepSpaceAudio(tier,onState,{inspect=false}={}){
  const config=TIERS[tier]||TIERS.low;
  let graph=null,wanted=false,blocked=false,disposed=false,pending=null,epoch=0,suspendTimer;
  let time=0,distance=12000,envelope=1,lastUpdate=-Infinity,nextEvent=40+Math.random()*50,eventStart=-Infinity,eventCount=0;
  const notify=()=>onState(wanted && !!graph);
  function destroy(){
    clearTimeout(suspendTimer);suspendTimer=null;
    if(graph){graph.nodes.forEach(n=>n.dispose());graph=null;}
  }
  async function build(){
    const nodes=[],own=n=>{nodes.push(n);return n;};
    const master=own(new Tone.Gain(0));
    // Native compressor avoids an AudioWorklet fetch in the standalone file.
    const compressor=own(new Tone.Compressor({threshold:-18,ratio:5,attack:.08,release:1}));
    master.chain(compressor,Tone.getDestination());
    const meter=inspect?own(new Tone.Analyser('waveform',2048)):null;
    if(meter)compressor.connect(meter);
    const gates={};
    for(const name of ['high','mid','drone','floor','event','wind'])gates[name]=own(new Tone.Gain(0)).connect(master);
    // Dry, enclosed windshield turbulence. No space reverb on this surface sound.
    const windNoise=own(new Tone.Noise('pink'));
    const windHigh=own(new Tone.Filter({type:'highpass',frequency:85,rolloff:-24}));
    const windLow=own(new Tone.Filter({type:'lowpass',frequency:1150,rolloff:-24,Q:.65}));
    const windBody=own(new Tone.Filter({type:'peaking',frequency:240,Q:1.1,gain:4}));
    const windGain=own(new Tone.Gain(.21));const windPan=own(new Tone.Panner(0));
    windNoise.chain(windHigh,windLow,windBody,windGain,windPan,gates.wind);windNoise.start();
    own(new Tone.LFO({frequency:.37,min:.11,max:.25,type:'sine'})).connect(windGain.gain).start();
    own(new Tone.LFO({frequency:.19,min:-.25,max:.25,type:'sine'})).connect(windPan.pan).start();
    // A single shared convolution; band gates FOLLOW effects, so tails cannot
    // leak high/mid frequencies into the final isolated 30 Hz passage.
    const reverb=own(new Tone.Reverb({decay:config.decay,preDelay:.12,wet:1}));
    const highSplit=own(new Tone.Filter({type:'highpass',frequency:480,rolloff:-24}));
    const midSplit=own(new Tone.Filter({type:'lowpass',frequency:480,rolloff:-24}));
    reverb.connect(highSplit);reverb.connect(midSplit);
    highSplit.connect(gates.high);midSplit.connect(gates.mid);
    const delay=own(new Tone.FeedbackDelay({delayTime:4.1,maxDelay:5,feedback:.17,wet:.32}));
    delay.connect(reverb);
    if(config.extra){
      const left=own(new Tone.FeedbackDelay({delayTime:2.7,maxDelay:5,feedback:.13,wet:1}));
      const pan=own(new Tone.Panner(-.55));left.chain(pan,reverb);delay.connect(left);
    }
    const filter=own(new Tone.Filter({type:'lowpass',frequency:600,rolloff:-24,Q:.4}));
    filter.connect(delay);
    own(new Tone.LFO({frequency:.031,min:240,max:960,type:'sine'})).connect(filter.frequency).start();
    const breath=own(new Tone.Gain(.8));breath.connect(gates.drone);
    own(new Tone.LFO({frequency:.023,min:.65,max:.9,type:'sine'})).connect(breath.gain).start();
    const voices=[];
    const voice=(frequency,type,level,destination)=>{
      const envelope=own(new Tone.AmplitudeEnvelope({attack:12,decay:4,sustain:.8,release:24}));
      const gain=own(new Tone.Gain(level));
      const oscillator=own(new Tone.Oscillator({frequency,type}));
      oscillator.chain(envelope,gain,destination);oscillator.start();envelope.triggerAttack();
      voices.push(envelope);return oscillator;
    };
    voice(36,'sine',.13,breath);voice(73,'triangle',.045,breath);
    if(config.extra)voice(54.3,'sine',.045,breath);
    voice(173.2,'triangle',.032,filter);voice(617.3,'sine',.023,filter);
    voice(30,'sine',.09,gates.floor);
    const sub=voice(38,'sine',.12,gates.event);
    graph={nodes,master,gates,sub,meter,voices,reverb};
    try{await reverb.ready;}catch(error){destroy();throw error;}
  }
  function update(t,d,level=1){
    if(t<time-.1){nextEvent=40+Math.random()*50;eventStart=-Infinity;eventCount=0;}
    time=t;distance=d;envelope=Math.max(0,Math.min(1,level));
    if(!graph)return;
    const now=Tone.now();
    if(Math.abs(t-lastUpdate)<.08 && t!==DURATION)return;
    lastUpdate=t;
    const score=soundScore(t,d);
    if(wanted&&!blocked&&t>=nextEvent&&t<68){
      eventStart=t;nextEvent=t+40+Math.random()*50;eventCount++;
      graph.sub.frequency.cancelAndHoldAtTime(now);
      graph.sub.frequency.setValueAtTime(38,now);graph.sub.frequency.linearRampToValueAtTime(29,now+18);
    }
    const age=t-eventStart,event=smooth(age/8)*fade(age,12,28)*fade(t,64,68);
    const targets={...score,event};
    for(const name of ['high','mid','drone','floor','event','wind']){
      const param=graph.gates[name].gain;
      param.cancelAndHoldAtTime(now);
      param.linearRampToValueAtTime(targets[name],now+.08);
    }
    graph.master.gain.cancelAndHoldAtTime(now);
    graph.master.gain.linearRampToValueAtTime(wanted&&!blocked&&t<DURATION?(.65+score.proximity*.2)*envelope:0,now+.08);
    if(!wanted||t>=DURATION){
      if(!suspendTimer)suspendTimer=setTimeout(()=>{
        suspendTimer=null;
        if(graph&&(!wanted||time>=DURATION))Tone.getContext().rawContext.suspend().catch(()=>{});
      },160);
    }else{clearTimeout(suspendTimer);suspendTimer=null;}
  }
  function refresh(){lastUpdate=-Infinity;update(time,distance,envelope);}
  function enable(){
    try{sessionStorage.setItem('ti_audio_muted','0');}catch{}
    if(disposed)return Promise.resolve();
    clearTimeout(suspendTimer);suspendTimer=null;wanted=true;notify();
    // Called synchronously from pointer/keyboard/click, before any await.
    const unlocked=Tone.start();
    if(pending)return pending;
    const token=epoch;
    pending=(async()=>{
      try{
        await unlocked;
        if(disposed||token!==epoch)return;
        if(!graph)await build();
        if(disposed||token!==epoch){destroy();return;}
        if(blocked)await Tone.getContext().rawContext.suspend();
        refresh();notify();
      }catch(error){wanted=false;destroy();notify();console.warn('Ending audio unavailable',error);}
      finally{pending=null;}
    })();
    return pending;
  }
  function mute(){wanted=false;try{sessionStorage.setItem('ti_audio_muted','1');}catch{}refresh();notify();}
  function pause(){blocked=true;refresh();if(graph)Tone.getContext().rawContext.suspend().catch(()=>{});}
  function resume(){
    blocked=false;
    if(graph&&wanted)Tone.getContext().rawContext.resume().then(refresh).catch(()=>{wanted=false;notify();});
  }
  function replay(){
    // Clear convolution/delay history as well as event scheduling on replay.
    epoch++;destroy();lastUpdate=-Infinity;time=0;eventStart=-Infinity;eventCount=0;nextEvent=40+Math.random()*50;
    if(wanted){const old=pending;pending=null;if(old)old.then(()=>{if(wanted&&!disposed)enable();});else enable();}
  }
  return {
    enable,mute,pause,resume,replay,update,
    get enabled(){return wanted;},
    dispose(){disposed=true;epoch++;wanted=false;destroy();},
    snapshot:()=>({enabled:wanted,ready:!!graph,context:graph?Tone.getContext().state:'locked',decay:config.decay,time,nextEvent,eventCount,score:soundScore(time,distance),...(graph?.meter?{waveform:Array.from(graph.meter.getValue())}:{})})
  };
}
