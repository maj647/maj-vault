/* Maj Vault / Maj Clients: trim on the waveform. Drag the in/out handles, the selection loops,
   then download it (WAV/MP3) or save it as a new version — at your varispeed if one is set.
   Copyright (c) 2026 Adil Majarali. All rights reserved. */
(() => {
  'use strict';
  const g = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
  const $ = id => document.getElementById(id);
  const fmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
  const T = {on: false, a: 0, b: 0, loop: true, fadeOut: false, key: null};
  let audio, bar, box, row, raf = 0;

  const SC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8.2 7.5 20 17M8.2 16.5 20 7M13.5 12h.01"/></svg>';
  function css(){
    const s = document.createElement('style'); s.textContent = `
.seek.has-trim{grid-template-columns:auto 1fr auto auto}
#ptrimbtn{border:0;background:none;color:var(--muted);width:32px;height:32px;border-radius:50%;display:grid;place-items:center;cursor:pointer;padding:0}
#ptrimbtn:hover,#ptrimbtn[aria-pressed="true"]{color:var(--fg);background:var(--accent-soft)}
#ptrim{position:absolute;inset:-4px 0;pointer-events:none;z-index:3}
#ptrim .tr-sh{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--bg) 72%,transparent);pointer-events:none}
#ptrim .tr-sel{position:absolute;top:0;bottom:0;border-top:2px solid var(--amber,#f5b544);border-bottom:2px solid var(--amber,#f5b544);pointer-events:none}
#ptrim .tr-hd{position:absolute;top:-6px;bottom:-6px;width:30px;margin-left:-15px;pointer-events:auto;cursor:ew-resize;touch-action:none;background:none;border:0;padding:0;outline:none}
#ptrim .tr-hd:before{content:"";position:absolute;left:12px;top:0;bottom:0;width:6px;border-radius:3px;background:var(--amber,#f5b544);box-shadow:0 0 0 1px rgb(0 0 0/.25)}
#ptrim .tr-hd.tr-a:before{border-radius:3px 0 0 3px}#ptrim .tr-hd.tr-b:before{border-radius:0 3px 3px 0}
#ptrim .tr-hd:focus-visible:before{box-shadow:0 0 0 3px color-mix(in srgb,var(--amber,#f5b544) 45%,transparent)}
#ptrim .tr-hd i{position:absolute;left:50%;transform:translateX(-50%);top:-20px;font:600 11px var(--body);font-style:normal;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:1px 5px;white-space:nowrap;opacity:0;transition:opacity .12s}
#ptrim .tr-hd.drag i,#ptrim .tr-hd:focus-visible i{opacity:1}
#ptrimrow[hidden]{display:none!important}#ptrimrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 2px;font-size:13px}
#ptrimrow .tt{white-space:nowrap;font:600 13px var(--body);font-variant-numeric:tabular-nums;margin-right:auto;display:flex;gap:6px;align-items:center}
#ptrimrow .tt small{color:var(--muted);font-weight:500}
#ptrimrow button{border:1px solid var(--line);background:var(--chip);color:var(--fg);border-radius:999px;padding:6px 11px;font:500 12.5px var(--body);cursor:pointer;white-space:nowrap}
#ptrimrow button.tr-p{background:var(--accent);border-color:var(--accent);color:var(--accent-fg,#fff)}
#ptrimrow button[aria-pressed="true"]{border-color:var(--amber,#f5b544)}
@media (max-width:520px){#ptrimrow .tt{flex-basis:100%}}#ptrimrow .st{flex-basis:100%;color:var(--muted);font-size:12.5px}
#ptrimmenu{position:fixed;z-index:9999;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:6px;box-shadow:0 12px 40px rgb(0 0 0/.35);min-width:220px}
#ptrimmenu button{display:block;width:100%;text-align:left;border:0;background:none;color:var(--fg);font:500 14px var(--body);padding:10px 12px;border-radius:9px;cursor:pointer}
#ptrimmenu button:hover{background:var(--accent-soft)}#ptrimmenu small{display:block;color:var(--muted);font-size:12px;font-weight:400}`;
    document.head.append(s);
  }

  function mount(){
    audio = $('audio'); bar = $('pbar'); const seek = bar?.closest('.seek'); if (!audio || !seek) return false;
    css();
    seek.classList.add('has-trim');
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'ptrimbtn'; btn.innerHTML = SC; btn.title = 'Trim: pick a part, loop it, export it'; btn.setAttribute('aria-label', 'Trim'); btn.setAttribute('aria-pressed', 'false');
    btn.onclick = () => T.on ? stop() : start(); seek.append(btn);
    box = document.createElement('div'); box.id = 'ptrim'; box.hidden = true;
    box.innerHTML = `<div class="tr-sh tr-l"></div><div class="tr-sh tr-r"></div><div class="tr-sel"></div><button type="button" class="tr-hd tr-a" role="slider" aria-label="Trim start"><i></i></button><button type="button" class="tr-hd tr-b" role="slider" aria-label="Trim end"><i></i></button>`;
    bar.append(box);
    row = document.createElement('div'); row.id = 'ptrimrow'; row.hidden = true;
    row.innerHTML = `<span class="tt"><span id="ptrimt"></span><small id="ptrimd"></small></span><button type="button" data-t="a" title="Start the trim at the playhead">In here</button><button type="button" data-t="b" title="End the trim at the playhead">Out here</button><button type="button" data-t="loop" aria-pressed="true" title="Loop the selection">Loop</button><button type="button" class="tr-p" data-t="export">Export…</button><button type="button" data-t="close" aria-label="Close trim">×</button><span class="st" id="ptrimst" hidden></span>`;
    seek.after(row);
    row.addEventListener('click', onRow);
    for (const h of box.querySelectorAll('.tr-hd')) wireHandle(h);
    audio.addEventListener('loadedmetadata', () => { if (audio.src.startsWith('data:')) return; if (T.on && T.key !== curKey()) stop(); else if (T.on) clamp(), paint(); });
    audio.addEventListener('timeupdate', guard);
    audio.addEventListener('play', () => { if (T.on && T.loop && (audio.currentTime < T.a - 0.05 || audio.currentTime >= T.b)) audio.currentTime = T.a; tick(); });
    new ResizeObserver(paint).observe(bar);
    return true;
  }
  const curKey = () => { const v = g('nowV'); return v ? (v.id || v.gmail + '|' + v.name) : null; };
  const dur = () => audio.src.startsWith('data:') ? 0 : (audio.duration || 0);

  function start(){
    const d = dur(); if (!d || !isFinite(d)) return g('toast')?.('Play a song first, then trim it.');
    T.on = true; T.key = curKey();
    const c = audio.currentTime || 0;
    // start around where you are: from the playhead for 30 s, or the whole song if you're at the top
    if (c < 1) { T.a = 0; T.b = d; } else { T.a = Math.max(0, c - 0.0); T.b = Math.min(d, c + 30); }
    box.hidden = row.hidden = false; $('ptrimbtn').setAttribute('aria-pressed', 'true');
    bar.classList.add('trimming'); paint(); tick();
  }
  function stop(){ T.on = false; box.hidden = row.hidden = true; $('ptrimbtn')?.setAttribute('aria-pressed', 'false'); bar.classList.remove('trimming'); closeMenu(); }
  function clamp(){ const d = dur(); if (!d || !isFinite(d)) return; T.a = Math.max(0, Math.min(T.a, d - 0.1)); T.b = Math.max(T.a + 0.1, Math.min(T.b, d)); }
  function paint(){
    if (!T.on || !box) return; const d = dur(); if (!d) return;
    const pa = T.a / d * 100, pb = T.b / d * 100;
    box.querySelector('.tr-l').style.cssText = `left:0;width:${pa}%`; box.querySelector('.tr-r').style.cssText = `left:${pb}%;right:0`;
    box.querySelector('.tr-sel').style.cssText = `left:${pa}%;width:${pb - pa}%`;
    const ha = box.querySelector('.tr-a'), hb = box.querySelector('.tr-b');
    ha.style.left = pa + '%'; hb.style.left = pb + '%'; ha.firstChild.textContent = fmt(T.a); hb.firstChild.textContent = fmt(T.b);
    ha.setAttribute('aria-valuetext', fmt(T.a)); hb.setAttribute('aria-valuetext', fmt(T.b));
    $('ptrimt').textContent = `${fmt(T.a)} – ${fmt(T.b)}`; $('ptrimd').textContent = `${(T.b - T.a).toFixed(1)} s`;
  }
  function guard(){ if (T.on && T.loop && !audio.paused && audio.currentTime >= T.b) audio.currentTime = T.a; }
  function tick(){ cancelAnimationFrame(raf); const f = () => { if (!T.on || audio.paused) return; if (T.loop && audio.currentTime >= T.b - 0.01) audio.currentTime = T.a; raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); }

  function wireHandle(h){
    const isA = h.classList.contains('tr-a');
    h.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault(); h.setPointerCapture?.(e.pointerId); h.classList.add('drag'); h.focus({preventScroll: true});
      const r = bar.getBoundingClientRect(), d = dur();
      const mv = ev => { const t = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * d; if (isA) T.a = Math.min(t, T.b - 0.1); else T.b = Math.max(t, T.a + 0.1); clamp(); paint(); };
      const up = () => { h.classList.remove('drag'); h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        // hear it: from the new start, or the last 2 s before the new end
        audio.currentTime = isA ? T.a : Math.max(T.a, T.b - 2); };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
    h.addEventListener('click', e => e.stopPropagation());
    h.addEventListener('keydown', e => {
      const st = e.shiftKey ? 1 : 0.1, k = e.key; if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      e.preventDefault(); e.stopPropagation(); const dv = k === 'ArrowLeft' ? -st : st;
      if (isA) T.a = Math.min(T.a + dv, T.b - 0.1); else T.b = Math.max(T.b + dv, T.a + 0.1); clamp(); paint();
    });
  }

  function onRow(e){
    const b = e.target.closest('[data-t]'); if (!b) return; const t = b.dataset.t;
    if (t === 'close') return stop();
    if (t === 'a') { T.a = Math.min(audio.currentTime, T.b - 0.1); clamp(); paint(); }
    if (t === 'b') { T.b = Math.max(audio.currentTime, T.a + 0.1); clamp(); paint(); audio.currentTime = Math.max(T.a, T.b - 2); }
    if (t === 'loop') { T.loop = !T.loop; b.setAttribute('aria-pressed', String(T.loop)); }
    if (t === 'export') openMenu(b);
  }

  /* ---------- export ---------- */
  let menu = null;
  const closeMenu = () => { menu?.remove(); menu = null; document.removeEventListener('pointerdown', outside, true); };
  const outside = e => { if (menu && !menu.contains(e.target)) closeMenu(); };
  function openMenu(anchor){
    closeMenu();
    const r0 = g('curRate')?.() || {rate: 1}, sp = r0.rate !== 1 ? ` at ${r0.rate.toFixed(2)}×` : '', canSave = !!window.MV?.uploadToVault;
    menu = document.createElement('div'); menu.id = 'ptrimmenu'; menu.setAttribute('role', 'menu');
    menu.innerHTML = `<button type="button" role="menuitem" data-x="mp3">Download MP3<small>320 kbps${sp}</small></button><button type="button" role="menuitem" data-x="wav">Download WAV<small>full quality${sp}</small></button>${canSave ? `<button type="button" role="menuitem" data-x="save">Save as a new version<small>goes in this song’s list, ready to send</small></button>` : ''}<button type="button" role="menuitem" data-x="fade" aria-pressed="${T.fadeOut}">${T.fadeOut ? '✓ ' : ''}Fade out the end<small>2 s fade instead of a hard stop</small></button>`;
    document.body.append(menu);
    const r = anchor.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw)) + 'px';
    menu.style.top = (r.top - mh - 6 > 8 ? r.top - mh - 6 : r.bottom + 6) + 'px';
    menu.addEventListener('click', ev => { const x = ev.target.closest('[data-x]')?.dataset.x; if (!x) return; if (x === 'fade') { T.fadeOut = !T.fadeOut; return openMenu(anchor); } closeMenu(); doExport(x); });
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    menu.querySelector('button')?.focus();
  }
  const status = m => { const s = $('ptrimst'); if (s) { s.textContent = m || ''; s.hidden = !m; } row?.querySelectorAll('button').forEach(b => b.disabled = !!m); };
  const tag = t => { const m = Math.floor(t / 60), s = Math.round(t % 60); return `${m}m${String(s).padStart(2, '0')}s`; };

  async function render(blob, a, b, rate, keep, sr){
    const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(sr ? {sampleRate: sr} : undefined);
    const buf = await ac.decodeAudioData(await blob.arrayBuffer()); ac.close?.();
    const fs = buf.sampleRate, s0 = Math.floor(a * fs), s1 = Math.min(buf.length, Math.ceil(b * fs));
    let chans = []; for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c).slice(s0, s1));
    if (rate !== 1) {
      if (keep && g('wsola')) { const w = g('wsola'), out = []; for (const c of chans) { out.push(w(c, rate)); await new Promise(r => setTimeout(r)); } chans = out; }
      else {
        const src = new AudioBuffer({numberOfChannels: chans.length, length: chans[0].length, sampleRate: fs}); chans.forEach((c, i) => src.copyToChannel(c, i));
        const off = new OfflineAudioContext(chans.length, Math.ceil(chans[0].length / rate), fs), n = off.createBufferSource();
        n.buffer = src; n.playbackRate.value = rate; n.connect(off.destination); n.start();
        const o = await off.startRendering(); chans = []; for (let c = 0; c < o.numberOfChannels; c++) chans.push(o.getChannelData(c));
      }
    }
    // soft edges so it never clicks; optional 2 s fade at the end
    const len = chans[0].length, fi = Math.min(len >> 1, Math.round(fs * 0.012)), fo = Math.min(len >> 1, Math.round(fs * (T.fadeOut ? 2 : 0.012)));
    for (const c of chans) { for (let i = 0; i < fi; i++) c[i] *= i / fi; for (let i = 0; i < fo; i++) { const x = 1 - i / fo; c[len - 1 - (fo - 1 - i)] *= T.fadeOut ? x * x : x; } }
    return {chans, sr: fs};
  }
  async function doExport(kind){
    const v = g('nowV'), k = g('nowKey'), s = g('songs')?.get(k); if (!v) return;
    const {rate = 1, keep = false} = g('curRate')?.() || {}, a = T.a, b = T.b;
    const fmtK = kind === 'save' ? 'mp3' : kind;
    const base = v.name.replace(/^\d{4}-\d{2}-\d{2} \d{4} · /, '').replace(/\.[^.]+$/, '');
    const name = `${base} (trim ${tag(a)}-${tag(b)}${rate !== 1 ? ' ' + g('speedTag')(rate, keep) : ''}).${fmtK}`;
    try {
      status('Getting the file…');
      const blob = g('curBlob') || await g('fetchAudio')(v);
      status(rate !== 1 && keep ? 'Trimming and stretching (keeps the pitch)…' : 'Trimming…');
      const an = g('anOf')?.(v)?.fmt || g('fmtLocal')?.get(g('normName')(v.name)) || {};
      const out = await render(blob, a, b, rate, keep, an.rate || undefined);
      status(fmtK === 'wav' ? 'Writing the WAV…' : 'Encoding MP3 (320 kbps)…');
      const file = fmtK === 'wav' ? g('wavOf')(out, an.bits === 16 ? 16 : 24) : await g('mp3Of')(out);
      if (kind !== 'save') { status(''); return g('saveBlob')(name, file); }
      status('Saving it to the song’s Vault folder…');
      const f = await window.MV.uploadToVault(new File([file], name, {type: file.type}), s?.title || base);
      const nv = {id: f.id, name, size: file.size, src: 'V', date: new Date().toISOString(), song: s?.title || base};
      g('fetched')?.set(g('normName')(name), file); s?.versions.unshift(nv);
      status(''); g('draw')?.(); g('toast')?.(`Saved “${name}” as a new version.`);
    } catch (e) { status(''); g('toast')?.('Couldn’t make the trim: ' + (e?.message || e?.code || e)); }
  }

  // a scissors on every playable version too: plays it and opens the trim handles
  function rowButtons(){
    for (const v of document.querySelectorAll('.ver.pl')) {
      const act = v.querySelector('.vact'); if (!act || act.querySelector('.tr-row')) continue;
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'ib tr-row'; bt.title = 'Trim this version'; bt.setAttribute('aria-label', 'Trim this version'); bt.innerHTML = SC;
      act.prepend(bt);
    }
  }
  document.addEventListener('click', e => {
    const bt = e.target.closest('.tr-row'); if (!bt) return;
    e.stopPropagation(); e.preventDefault();
    const row = bt.closest('.ver'), key = row?.dataset.key, play = row?.querySelector('[data-act="play"]');
    if (T.on && curKey() === key) return;
    if (curKey() === key && dur()) return start();
    play?.click();
    let n = 0; const tm = setInterval(() => { if (curKey() === key && dur() && !audio.src.startsWith('data:')) { clearInterval(tm); audio.currentTime = 0; start(); } else if (++n > 60) clearInterval(tm); }, 250);
  }, true);
  new MutationObserver(() => { clearTimeout(rowButtons.t); rowButtons.t = setTimeout(rowButtons, 120); }).observe(document.documentElement, {childList: true, subtree: true});

  const wait = setInterval(() => { try { if ($('pbar') && g('songs')) { clearInterval(wait); mount(); } } catch (_) {} }, 400);
  window.__trim = T;
})();
