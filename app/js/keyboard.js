'use strict';

// Android resizes the WebView via IME insets; mobile browsers expose a visual viewport.
window.KeyboardLayout = (() => {
  let nativeVisible=null, baseline=window.innerHeight, width=window.innerWidth, frame=0, timer=0;
  const editable=el=>el && el.matches('textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]),[contenteditable="true"]');
  function reveal() {
    const el=document.activeElement;
    if(!editable(el)||!document.body.classList.contains('keyb'))return;
    const scroller=el.closest('.sheet-body') || el.closest('#pageBody');
    if(!scroller)return;
    const field=el.getBoundingClientRect(),bounds=scroller.getBoundingClientRect();
    const footer=scroller.querySelector('.entry-submit');
    const footerHeight=footer&&getComputedStyle(footer).position==='sticky'?footer.offsetHeight:0;
    const top=bounds.top+12,bottom=Math.min(bounds.bottom,(window.visualViewport?.height || window.innerHeight)+(window.visualViewport?.offsetTop || 0))-footerHeight-14;
    if(field.bottom>bottom)scroller.scrollTop+=field.height>bottom-top?field.top-top:field.bottom-bottom;
    else if(field.top<top)scroller.scrollTop-=top-field.top;
  }
  function update() {
    frame=0;
    const vp=window.visualViewport,focused=editable(document.activeElement);
    if(Math.abs(window.innerWidth-width)>60){width=window.innerWidth;baseline=window.innerHeight;}
    const height=Math.min(window.innerHeight,vp?.height || window.innerHeight),top=vp?.offsetTop || 0;
    if(!focused && nativeVisible!==true)baseline=window.innerHeight;
    baseline=Math.max(baseline,window.innerHeight);
    const visible=nativeVisible ?? (focused && baseline-height>120);
    document.body.classList.toggle('keyb',!!visible);
    document.documentElement.style.setProperty('--visible-height',Math.round(height)+'px');
    document.documentElement.style.setProperty('--visible-top',Math.round(top)+'px');
    requestAnimationFrame(reveal);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  function init(){
    window.addEventListener('resize',schedule);
    window.visualViewport?.addEventListener('resize',schedule);
    window.visualViewport?.addEventListener('scroll',schedule);
    document.addEventListener('focusin',()=>{schedule();clearTimeout(timer);timer=setTimeout(reveal,320);});
    document.addEventListener('focusout',()=>{clearTimeout(timer);timer=setTimeout(schedule,100);});
    document.addEventListener('input',()=>{if(document.body.classList.contains('keyb'))schedule();});
    schedule();
  }
  return {init,nativeChanged(visible){nativeVisible=!!visible;schedule();},reveal};
})();
