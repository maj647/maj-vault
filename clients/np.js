/* Maj Vault / Maj Clients: Now Playing with a spinning record.
   The cover is the label on a vinyl disc that turns while the song plays, the waveform sits right
   under it as the scrubber, then the transport, then all the usual controls.
   Copyright (c) 2026 Adil Majarali. All rights reserved. */
(() => {
  'use strict';
  const g = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
  const $ = id => document.getElementById(id);

  const css = `
/* full-screen on every size (phones had it already) */
.dock.np{top:0;display:flex;flex-direction:column;overflow:auto;background:var(--bg);isolation:isolate}
.dock.np:before{content:"";position:fixed;inset:-80px;z-index:-1;background:var(--np-bg,none) center/cover no-repeat;filter:blur(70px) saturate(1.5);opacity:.42;transform:scale(1.2);transition:opacity .6s}
.dock.np:after{content:"";position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,color-mix(in srgb,var(--bg) 35%,transparent),var(--bg) 78%)}
.dock.np .wrap{flex:1;display:flex;flex-direction:column;justify-content:flex-start;gap:10px;max-width:560px;margin-inline:auto;width:100%;padding-top:calc(8px + env(safe-area-inset-top,0px))}
.dock.np .player{display:flex!important;flex-direction:column;align-items:stretch;gap:14px}
.dock.np .seek{order:2;width:100%;display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:10px}
.dock.np #ptrimrow{order:2}
.dock.np .npgrab{all:unset;display:grid;place-items:center;align-self:center;width:100%;height:26px;cursor:pointer;order:0}
.dock.np .npgrab span{display:block;width:44px;height:5px;border-radius:9px;background:var(--line)}
.dock.np .npart{display:grid;justify-items:center;gap:8px;text-align:center;padding:4px 0 0;order:1}
.dock.np .prow{order:3;flex-wrap:wrap;justify-content:center;gap:10px;display:flex}
.dock.np .pextra{order:4;max-height:none;overflow:visible}
.dock.np .pmeta{flex-basis:100%;order:-1;text-align:center}
.dock.np .player .pt{display:none}
.dock.np .pmeta .lyrnow{white-space:normal;font-size:16px;color:var(--fg);min-height:2.6em}
.dock.np .pbtn{min-width:48px;height:48px}
.dock.np .pbtn.pp{min-width:70px;height:70px;font-size:24px;border-radius:50%}
.dock.np #pback,.dock.np #pfwd{display:grid!important}
.dock.np #pclose,.dock.np #pmore,.dock.np #pfind,.dock.np #pspd{display:none!important}
.dock.np #pback{order:1}.dock.np #pprev{order:2}.dock.np #pplay{order:3}.dock.np #pnext{order:4}.dock.np #pfwd{order:5}
.dock.np #presume{order:6;flex-basis:100%;height:36px}
.dock.np .sbar,.dock.np .sbar.wvon{height:72px}
.dock.np .seek .tm{font-variant-numeric:tabular-nums;font-size:12.5px}
.nptitle[data-npinfo]{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font:700 21px var(--body);padding:0 8px;overflow-wrap:anywhere;letter-spacing:-.01em}

/* the record */
.mvdisc{--d:min(78vw,360px);position:relative;width:var(--d);height:var(--d);margin:6px auto 4px;border-radius:50%;
  background:
    radial-gradient(circle at 50% 50%,transparent 0 31%,rgb(255 255 255/.05) 31.3%,transparent 32%),
    repeating-radial-gradient(circle at 50% 50%,#0d0d10 0 1.6px,#16161b 1.6px 3.1px),
    #0b0b0e;
  box-shadow:0 40px 80px -36px rgb(0 0 0/.85),0 0 0 1px rgb(255 255 255/.06) inset,0 0 0 6px rgb(0 0 0/.25);
  animation:mvspin 2.4s linear infinite;animation-play-state:paused}
@media (min-height:820px) and (min-width:641px){.mvdisc{--d:380px}}
@media (max-height:700px){.mvdisc{--d:min(62vw,250px)}}
.dock.np.mvplaying .mvdisc{animation-play-state:running}
@keyframes mvspin{to{transform:rotate(360deg)}}
:root .dock .mvdisc .art.npcover,:root[data-skin] .dock .mvdisc .art.npcover{position:absolute!important;left:50%;top:50%;width:46%!important;height:46%!important;margin:0;transform:translate(-50%,-50%);border-radius:50%!important;box-shadow:0 0 0 2px rgb(0 0 0/.5),0 0 0 3px rgb(255 255 255/.08)!important;overflow:hidden}
:root .dock .mvdisc .art.npcover img{width:100%;height:100%;object-fit:cover;border-radius:50%}
:root[data-skin] .dock .mvdisc .art.npcover b,:root .dock .mvdisc .art.npcover b{font-size:calc(var(--d) * .16)!important}
.mvdisc:after{content:"";position:absolute;left:50%;top:50%;width:3.2%;height:3.2%;transform:translate(-50%,-50%);border-radius:50%;background:var(--bg);box-shadow:0 0 0 1px rgb(255 255 255/.15)}
/* light on the vinyl stays still while the record turns */
.mvsheen{position:absolute;inset:0;border-radius:50%;pointer-events:none;background:conic-gradient(from 20deg,transparent 0 8%,rgb(255 255 255/.07) 12%,transparent 18% 50%,rgb(255 255 255/.05) 62%,transparent 68%);mix-blend-mode:screen}
.mvdwrap{position:relative;width:max-content;margin:0 auto}
@media (prefers-reduced-motion:reduce){.mvdisc{animation:none}}

/* the song you're on: its cover turns into a little record in the list and in the open song */
:root .art.mvrec,:root[data-skin] .art.mvrec,:root[data-skin] .song .art.mvrec,:root[data-skin] .o2art .art.mvrec{border-radius:50%!important;position:relative;overflow:hidden;isolation:isolate;
  background:radial-gradient(circle,transparent 0 27%,rgb(255 255 255/.06) 27.5%,transparent 28.5%),repeating-radial-gradient(circle,#0d0d10 0 1px,#18181d 1px 2px),#0b0b0e!important;
  box-shadow:0 0 0 1px rgb(255 255 255/.08),0 8px 22px -10px rgb(0 0 0/.8)!important;animation:mvspin 2.4s linear infinite;animation-play-state:paused;cursor:grab;touch-action:none}
.art.mvrec:before{content:"";position:absolute;inset:21%;border-radius:50%;background:radial-gradient(120% 120% at 20% 15%,var(--c1,#555),var(--c2,#222));z-index:-1}
:root[data-skin] .art.mvrec img,:root .art.mvrec img{position:absolute!important;inset:21%!important;width:58%!important;height:58%!important;border-radius:50%!important;object-fit:cover}
.art.mvrec b{position:relative;font-size:.55em!important;transform:scale(.62)}
.art.mvrec:after{content:"";position:absolute;left:50%;top:50%;width:7%;height:7%;transform:translate(-50%,-50%);border-radius:50%;background:var(--bg);box-shadow:0 0 0 1px rgb(255 255 255/.18)}
:root[data-skin] .o2art .art.mvrec,:root .o2art .art.mvrec{width:112px!important;height:112px!important;font-size:30px}
.org2:has(.art.mvrec){align-items:center}
body.mvplaying .art.mvrec{animation-play-state:running}
.art.mvrec.mvgrab,.mvdisc.mvgrab{animation:none!important;cursor:grabbing}
.mvdisc{cursor:grab;touch-action:none}
.art.mvrec,.art.mvrec *{-webkit-user-drag:none;user-select:none}
@media (prefers-reduced-motion:reduce){.art.mvrec{animation:none}}
#mvmini{flex:none;display:grid;place-items:center;cursor:pointer;margin:0 4px 0 2px}
#mvmini[hidden],.dock.np #mvmini{display:none}
:root[data-skin] #mvmini .art,:root #mvmini .art{width:44px!important;height:44px!important;font-size:15px}
#mvmini .art.mvrec{box-shadow:0 0 0 1px rgb(255 255 255/.1),0 6px 16px -6px rgb(0 0 0/.9)!important}
`;
  function wrapCover(){
    const art = $('npart')?.querySelector('.art.npcover'); if (!art || art.closest('.mvdisc')) return;
    const w = document.createElement('div'); w.className = 'mvdwrap';
    const d = document.createElement('div'); d.className = 'mvdisc'; d.setAttribute('aria-hidden', 'true');
    art.replaceWith(w); d.append(art); w.append(d, Object.assign(document.createElement('div'), {className: 'mvsheen'}));
    paintBg();
  }
  function paintBg(){
    const img = $('npart')?.querySelector('.npcover img'), dock = $('dock'); if (!dock) return;
    if (img?.src) dock.style.setProperty('--np-bg', `url("${img.src.replace(/"/g, '%22')}")`);
    else { const a = $('npart')?.querySelector('.npcover'); const c = a && getComputedStyle(a); dock.style.setProperty('--np-bg', c ? c.backgroundImage : 'none'); }
  }
  function playing(){ const a = $('audio'), d = $('dock'); if (!a || !d) return; const on = !a.paused && !a.src.startsWith('data:'); d.classList.toggle('mvplaying', on); document.body.classList.toggle('mvplaying', on); marks(); }
  // which covers are "the song you're on"
  function marks(){
    const k = g('nowKey'), sel = k ? `#out .song[data-k="${CSS.escape(k)}"]` : null;
    for (const el of document.querySelectorAll('.art.mvrec')) if ((!sel || !el.closest(sel)) && !el.closest('#mvmini')) el.classList.remove('mvrec');
    if (!sel) return;
    for (const el of document.querySelectorAll(`${sel} .head .art, ${sel} .o2art .art`)) el.classList.add('mvrec');
  }
  // spin it with your finger (or scroll on it): the song follows the record like real vinyl —
  // forwards, backwards, held still = silence; the faster you throw it, the further it goes
  let block = 0, sess = null;
  const SEC_PER_TURN = 1.8;
  const accel = w => 1 + Math.min(4, Math.abs(w) / 900);          // fast spins cover more of the song
  function begin(el, ev){
    const a = $('audio'); if (!a || !a.src || a.src.startsWith('data:')) return null;
    const r = el.getBoundingClientRect(), m = getComputedStyle(el).transform; let rot = 0;
    if (m && m !== 'none') { const v = m.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number); if (v) rot = Math.atan2(v[1], v[0]) * 180 / Math.PI; }
    el.classList.add('mvgrab'); el.style.transform = `rotate(${rot}deg)`;
    const sel = el.classList.contains('mvdisc') ? '.mvdisc' : el.closest('#mvmini') ? '#mvmini .art' : el.closest('.o2art') ? '.o2art .art.mvrec' : '.song .head .art.mvrec';
    const S = {el, sel, a, rot, cx: r.left + r.width / 2, cy: r.top + r.height / 2, was: !a.paused, moved: 0, t0: Date.now(), w: 0, lt: performance.now(), pos: a.currentTime, live: false, idle: 0};
    SX.ready(a.currentTime); return S;
  }
  function turn(S, d){                                               // d = degrees turned since the last event
    const now = performance.now(), dt = Math.max(4, now - S.lt) / 1000; S.lt = now;
    if (!S.el.isConnected) { const n = document.querySelector(S.sel); if (n) { S.el = n; n.classList.add('mvgrab'); } }   // the page redrew under your finger: keep going on the new one
    S.rot += d; S.moved += Math.abs(d); S.el.style.transform = `rotate(${S.rot}deg)`;
    const w = d / dt; S.w = S.w * 0.55 + w * 0.45;                     // smoothed degrees per second
    if (S.moved > 6 && !S.live) { S.live = true; S.pos = S.a.currentTime; if (!S.a.paused) { quick = true; S.a.pause(); } spinRate(0); SX.start(S.pos); }
    if (S.live) { S.pos = Math.max(0, Math.min((S.a.duration || 1e9) - 0.05, S.pos + d / 360 * SEC_PER_TURN * accel(S.w))); SX.to(S.pos); }
    if (S.live && now - (S.lu || 0) > 120) { S.lu = now; S.a.currentTime = S.pos; }   // keep the waveform's playhead moving
    clearTimeout(S.idle); S.idle = setTimeout(() => { S.w = 0; }, 45);
  }
  function finish(S){
    clearTimeout(S.idle); S.el.classList.remove('mvgrab'); S.el.style.transform = ''; S.el.style.animationDelay = `-${(((S.rot % 360) + 360) % 360) / 360 * 2.4}s`;
    if (!S.live) return false;
    block = Date.now();
    SX.stop(); const at = S.pos; if (isFinite(at)) S.a.currentTime = Math.max(0, Math.min((S.a.duration || 1e9) - 0.05, at));
    spinRate(1); if (S.was) { quick = true; S.a.play().catch(() => {}); }
    return true;
  }
  function scratch(e){
    const el = e.target.closest('.mvdisc, .art.mvrec'); if (!el || e.button > 0) return;
    const S = begin(el, e); if (!S) return;
    e.preventDefault(); if (el.classList.contains('mvdisc')) e.stopPropagation();
    // listen on the window, not the record: the record can be redrawn mid-spin and a captured pointer would get lost
    const pid = e.pointerId;
    const ang = ev => Math.atan2(ev.clientY - S.cy, ev.clientX - S.cx) * 180 / Math.PI; let last = ang(e);
    const evs = ev => ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    const mv = ev => { if (ev.pointerId !== pid) return; ev.preventDefault(); for (const c of evs(ev)) { const A = ang(c); if (Math.hypot(c.clientX - S.cx, c.clientY - S.cy) < 8) continue; let d = A - last; if (d > 180) d -= 360; if (d < -180) d += 360; last = A; if (Math.abs(d) < 90) turn(S, d); } };
    const up = ev => { if (ev.pointerId !== pid) return; removeEventListener('pointermove', mv, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      if (!finish(S) && S.moved <= 6 && el.classList.contains('mvdisc') && Date.now() - S.t0 < 400) { block = Date.now(); $('pplay')?.click(); } };
    addEventListener('pointermove', mv, {capture: true, passive: false}); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  }
  // scroll / trackpad on the record: rail it back (scroll up) or push it forward, with momentum
  function wheel(e){
    const el = e.target.closest('.mvdisc, #mvmini .art, .o2art .art.mvrec'); if (!el) return;
    e.preventDefault();
    if (!sess || sess.el !== el) { sess = begin(el, e); if (!sess) return; sess.moved = 7; }
    const d = (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.9;     // pixels → degrees
    turn(sess, d);
    clearTimeout(sess.end); const S = sess; S.end = setTimeout(() => { finish(S); if (sess === S) sess = null; }, 380);
  }

  /* ---------- the sound of the record ---------- */
  // one continuous voice that reads the song at any speed, forwards or backwards, smoothed like a platter with weight
  const WORKLET = `class S extends AudioWorkletProcessor{constructor(){super();this.L=null;this.R=null;this.p=0;this.v=0;this.t=0;this.tp=0;this.follow=false;this.on=false;this.k=0;this.port.onmessage=e=>{const m=e.data;if(m.L){this.L=m.L;this.R=m.R||m.L;this.ratio=m.ratio}if('pos'in m)this.p=m.pos*this.ratio*sampleRate;if('to'in m){this.tp=m.to*this.ratio*sampleRate;this.follow=true}if('speed'in m){this.t=m.speed*this.ratio;this.follow=false}if('on'in m){this.on=m.on;if(!m.on)this.port.postMessage({pos:this.p/(this.ratio*sampleRate)})}}}
process(i,o){const out=o[0],l=out[0],r=out[1]||out[0],L=this.L,R=this.R;if(!L||!this.on){l.fill(0);if(r!==l)r.fill(0);return true}
const n=L.length;const lim=40*this.ratio;for(let j=0;j<l.length;j++){if(this.follow){let d=(this.tp-this.p)/(0.035*sampleRate);this.t=d>lim?lim:d<-lim?-lim:d}this.v+=(this.t-this.v)*0.004;this.p+=this.v;if(this.p<0)this.p=0;if(this.p>n-2)this.p=n-2;const a=this.p|0,f=this.p-a,av=Math.min(1,Math.abs(this.v)*3);l[j]=(L[a]+(L[a+1]-L[a])*f)*av;r[j]=(R[a]+(R[a+1]-R[a])*f)*av}
if((this.k+=l.length)>2048){this.k=0;this.port.postMessage({pos:this.p/(this.ratio*sampleRate)})}return true}}registerProcessor('mv-scratch',S)`;
  const SX = {ctx: null, node: null, key: '', busy: null, loaded: false, last: 0,
    async ready(pos){
      const a = $('audio');
      try { this.ctx ||= new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'interactive'}); this.ctx.resume(); } catch (_) { return; }
      if (!this.node && !this.busy) this.busy = (async () => { await this.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], {type: 'text/javascript'}))); this.node = new AudioWorkletNode(this.ctx, 'mv-scratch', {outputChannelCount: [2]}); this.node.connect(this.ctx.destination); this.node.port.onmessage = e => { if ('pos' in e.data) this.last = e.data.pos; }; })().catch(() => {}).finally(() => { this.busy = null; });
      if (this.key === a.src) return; this.key = a.src; this.loaded = false;
      try {
        const b = g('curBlob') || await (await fetch(a.src)).blob(); if (b.size > 160e6) return;
        const buf = await this.ctx.decodeAudioData(await b.arrayBuffer()); await this.busy; if (!this.node || this.key !== a.src) return;
        const L = buf.getChannelData(0).slice(), R = buf.numberOfChannels > 1 ? buf.getChannelData(1).slice() : null;
        this.node.port.postMessage({L, R, ratio: buf.sampleRate / this.ctx.sampleRate}, R ? [L.buffer, R.buffer] : [L.buffer]); this.loaded = true;
      } catch (_) { this.key = ''; }
    },
    start(pos){ this.last = pos; this.node?.port.postMessage({pos, to: pos, on: true}); },
    to(p){ this.node?.port.postMessage({to: p}); },
    stop(){ const p = this.loaded ? this.last : NaN; this.node?.port.postMessage({on: false, speed: 0}); return p; }};
  // the record's own spin follows the music: slows to a stop, spins back up
  function spinRate(r){ for (const el of document.querySelectorAll('.mvdisc, .art.mvrec')) for (const an of el.getAnimations?.() || []) an.playbackRate = r; }
  function ramp(a, from, to, ms, done){
    const r0 = a.playbackRate, pp = a.preservesPitch, t0 = performance.now(); a.preservesPitch = false;
    const f = () => { const p = Math.min(1, (performance.now() - t0) / ms), k = from + (to - from) * (to < from ? 1 - Math.pow(1 - p, 1.7) : Math.pow(p, 0.8));
      try { a.playbackRate = Math.max(0.07, r0 * k); } catch (_) {} spinRate(k);
      if (p < 1) requestAnimationFrame(f); else { try { a.playbackRate = r0; a.preservesPitch = pp; } catch (_) {} spinRate(1); done?.(); } };
    requestAnimationFrame(f);
  }
  window.__mvSX = SX;
  let stopping = false, quick = false, pausedAt = 0;
  // pause = the turntable's stop button: the song winds down like vinyl
  function onPauseClick(e){
    const b = e.target.closest('#pplay'), a = $('audio'); if (!b || stopping || !a || a.paused || a.src.startsWith('data:')) return;
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    e.stopImmediatePropagation(); e.preventDefault(); stopping = true;
    ramp(a, 1, 0, 650, () => { $('pplay').click(); stopping = false; });
  }
  function onPlay(){
    const a = $('audio'); if (a.src.startsWith('data:') || stopping) return;
    if (quick) { quick = false; return; }
    if (Date.now() - pausedAt < 250 || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    setTimeout(() => { if (!a.paused) ramp(a, 0.2, 1, 420); }, 0);   // and play = it spins back up to speed
  }

  /* ---------- a small record on the player bar at the bottom ---------- */
  let miniKey = '';
  async function mini(){
    const k = g('nowKey'), s = k && g('songs')?.get(k), box = $('mvmini'); if (!box) return;
    box.hidden = !s; if (!s || miniKey === k) return; miniKey = k;
    const art = g('songArt')?.(k, s);
    box.innerHTML = g('artHTML') ? g('artHTML')(art, k, s, s.title, 'mvminiart mvrec') : '';
    if (art && art.id && !art.local) { try { const u = await g('artUrl')(art.id); const el = box.querySelector('.art'); if (u && el && miniKey === k && !el.querySelector('img')) { el.insertAdjacentHTML('beforeend', `<img alt="" src="${u}">`); el.querySelector('b')?.remove(); } } catch (_) {} }
  }

  function mount(){
    const s = document.createElement('style'); s.textContent = css; document.head.append(s);
    const a = $('audio'); for (const e of ['play', 'playing', 'pause', 'ended', 'emptied']) a.addEventListener(e, playing);
    new MutationObserver(() => { wrapCover(); }).observe($('npart'), {childList: true, subtree: true});
    // cover pictures arrive later (img load) — refresh the blurred backdrop
    $('npart').addEventListener('load', paintBg, true);
    // tap a song's name in the list: it plays and opens the record view
    let want = 0;
    document.addEventListener('click', e => { if (e.target.closest('.song > .head') && !e.target.closest('.qact,input,select')) want = Date.now(); }, true);
    a.addEventListener('playing', () => { if (want && Date.now() - want < 4000 && window.mvNP && !$('dock').classList.contains('np')) { want = 0; window.mvNP(true); } });
    window.addEventListener('pointerdown', scratch, true);
    window.addEventListener('wheel', wheel, {capture: true, passive: false});
    window.addEventListener('click', e => { if (Date.now() - block < 500 && e.target.closest('.mvdisc, .art.mvrec')) { block = 0; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    new MutationObserver(() => { clearTimeout(marks.t); marks.t = setTimeout(marks, 60); }).observe($('out') || document.body, {childList: true, subtree: true});
    window.addEventListener('click', onPauseClick, true);
    a.addEventListener('play', onPlay); a.addEventListener('pause', () => { pausedAt = Date.now(); });
    const m = document.createElement('span'); m.id = 'mvmini'; m.hidden = true; m.title = 'Open the player'; m.setAttribute('role', 'button'); m.setAttribute('aria-label', 'Open Now Playing'); m.tabIndex = 0;
    m.addEventListener('click', () => window.mvNP?.(true)); m.addEventListener('keydown', e => { if (e.key === 'Enter') window.mvNP?.(true); });
    document.querySelector('#player .pmeta')?.before(m);
    for (const e of ['loadedmetadata', 'play']) a.addEventListener(e, () => setTimeout(mini, 50));
    playing();
  }
  const wait = setInterval(() => { if ($('npart') && $('audio') && g('songs')) { clearInterval(wait); mount(); } }, 400);
})();
/* a "peel to open" page for songs sent as links */
window.mvListen = v => {
  try {
    const g = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
    const ent = [...(g('songs') || [])].find(([, s]) => s.versions.includes(v)), k = ent?.[0], s = ent?.[1];
    const [c1, c2] = (k && g('colsFor')) ? g('colsFor')(k, s) : ['#7c5cff', '#2a1d5c'];
    const hex = c => { if (/^#/.test(c)) return c.slice(1); const m = String(c).match(/\d+(\.\d+)?/g); if (!m) return ''; if (/hsl/.test(c)) { const [h, s2, l] = m.map(Number), a = s2 / 100 * Math.min(l / 100, 1 - l / 100), f = n => { const kk = (n + h / 30) % 12; return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)))).toString(16).padStart(2, '0'); }; return f(0) + f(8) + f(4); } return m.slice(0, 3).map(x => (+x | 0).toString(16).padStart(2, '0')).join(''); };
    const p = new URLSearchParams({f: v.id, t: (s?.title || v.name.replace(/\.[^.]+$/, '')), by: window.MV_PROFILE?.artist || 'Maj', c1: hex(c1), c2: hex(c2)});
    return new URL(/\/clients\//.test(location.pathname) ? '../listen/' : 'listen/', location.href).href + '#' + p.toString();
  } catch (_) { return null; }
};
