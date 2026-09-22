// One safe-frame contract for both passages and the epilogue. Bundled inline.
export function installCinemaFrame(onResize) {
  const style=document.createElement('style');
  style.textContent=`
    :root{--cinema-top:0px;--cinema-bottom:0px;--cinema-left:0px;--cinema-right:0px;--cinema-matte:64px}
    header{top:calc(var(--cinema-top) + max(18px,env(safe-area-inset-top)));left:calc(var(--cinema-left) + max(20px,4vw));right:calc(var(--cinema-right) + max(20px,4vw));z-index:5}
    footer{bottom:calc(var(--cinema-bottom) + max(10px,env(safe-area-inset-bottom)));left:calc(var(--cinema-left) + max(16px,4vw));right:calc(var(--cinema-right) + max(16px,4vw));display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:5;font:9px/1.4 Arial,sans-serif;letter-spacing:.14em;color:#858e92}
    footer nav{display:flex;align-items:center;justify-content:flex-end;gap:12px}
    footer button,footer a{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:8px 10px;white-space:nowrap;color:#b0b9bc}
    footer #credit{max-width:none;white-space:nowrap;font-size:8px;letter-spacing:.10em}
    footer #sound{width:44px;padding:0}footer #sound svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
    footer #sound .sound-waves{display:none}footer #sound[aria-pressed=true] .sound-waves{display:initial}footer #sound[aria-pressed=true] .sound-muted{display:none}
    .matte.bottom,.frame.bottom{height:calc(var(--cinema-bottom) + var(--cinema-matte));z-index:2}
    .matte.top,.frame.top{height:calc(var(--cinema-top) + max(48px,7svh));z-index:2}
    #veil,#cut{z-index:3}#error,#loading{z-index:8}canvas{position:fixed}
    #line{bottom:calc(var(--cinema-bottom) + var(--cinema-matte) + 7svh)}
    @media(max-width:600px){footer{flex-direction:column-reverse;gap:0}footer nav{width:100%;justify-content:center;gap:4px}footer button,footer a{padding:8px 7px;font-size:8px}footer #credit{font-size:7px;line-height:16px}header{font-size:8px;letter-spacing:.16em}}
  `;
  document.head.append(style);
  let frame=0;
  function sync(){
    frame=0;const v=window.visualViewport,root=document.documentElement;
    const width=v?.width||innerWidth,height=v?.height||innerHeight,top=v?.offsetTop||0,left=v?.offsetLeft||0;
    root.style.setProperty('--cinema-top',`${top}px`);root.style.setProperty('--cinema-left',`${left}px`);
    root.style.setProperty('--cinema-bottom',`${Math.max(0,innerHeight-height-top)}px`);
    root.style.setProperty('--cinema-right',`${Math.max(0,innerWidth-width-left)}px`);
    root.style.setProperty('--cinema-matte',`${document.querySelector('footer').getBoundingClientRect().height+24}px`);
    onResize?.(Math.round(width),Math.round(height),left,top);
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
  for(const event of ['resize','orientationchange','pageshow'])addEventListener(event,schedule);
  window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  new ResizeObserver(schedule).observe(document.querySelector('footer'));
  sync();
}
