'use strict';

/* Scene, accent palette and preferred light/dark mode are separate preferences. */
const Appearance = (() => {
  const styles = [
    {id:'ink', name:'水墨清夏', description:'青山淡墨 · 日常账页', night:false},
    {id:'starry', name:'星空彼岸', description:'夜蓝星河 · 静谧远岸', night:true},
    {id:'coast', name:'碧海晴空', description:'晴云海浪 · 清透海蓝', night:false},
    {id:'future', name:'未来回响', description:'深蓝银线 · 青光远城', night:true}
  ];
  const palettes = [
    {id:'original',name:'原配'}, {id:'ocean',name:'海蓝'}, {id:'jade',name:'青绿'},
    {id:'violet',name:'雾紫'}, {id:'rose',name:'胭粉'}, {id:'sand',name:'暖杏'}
  ];
  function resolve(settings = {}, systemDark = false) {
    const style = styles.find(s=>s.id===settings.visualStyle) || styles[0];
    const preference = ['auto','light','dark'].includes(settings.theme) ? settings.theme : 'auto';
    const palette = palettes.some(p=>p.id===settings.themePalettes?.[style.id]) ? settings.themePalettes[style.id] : 'original';
    return {style, palette, mode:style.night?'dark':preference, dark:style.night || preference==='dark' || (preference==='auto' && systemDark)};
  }
  function apply(settings) {
    const state = resolve(settings, window.matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    root.dataset.visualStyle = state.style.id;
    root.dataset.theme = state.mode;
    root.dataset.tone = state.dark ? 'dark' : 'light';
    root.dataset.palette = state.palette;
    // Read the actual CSS surface, so native edges cannot drift from a new palette.
    const color = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (/^#[\da-f]{6}$/i.test(color)) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
      try {
        const bridge = window.AndroidBridge;
        if (bridge?.setThemeColors) bridge.setThemeColors(state.dark,color);
        else if (bridge?.setAppearance) bridge.setAppearance(state.dark,state.style.id==='starry');
        else if (bridge?.setStatusBar) bridge.setStatusBar(state.dark);
      } catch (e) { /* A browser or older wrapper may not expose appearance methods. */ }
    }
    // Canvas labels do not inherit new CSS colours until explicitly redrawn.
    if (window.Charts?.redraw) Charts.redraw();
    return state;
  }
  return {styles, palettes, resolve, apply};
})();
window.Appearance = Appearance;
