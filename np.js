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
  function playing(){ const a = $('audio'), d = $('dock'); if (!a || !d) return; d.classList.toggle('mvplaying', !a.paused && !a.src.startsWith('data:')); }

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
    playing();
  }
  const wait = setInterval(() => { if ($('npart') && $('audio') && g('songs')) { clearInterval(wait); mount(); } }, 400);
})();
