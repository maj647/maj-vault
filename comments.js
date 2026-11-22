/* Maj Vault / Maj Clients: notes as timed comments on the waveform, SoundCloud style.
   Each note sits as a little avatar on the waveform at its spot, pops up in a bubble when the song
   reaches it and fades away after; write a new one right under the waveform.
   Copyright (c) 2026 Adil Majarali. All rights reserved. */
(() => {
  'use strict';
  const g = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
  const $ = id => document.getElementById(id);
  const fmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; };
  const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  let audio, bar, layer, form, lastT = 0, shown = new Map();

  const css = `
#mvcl{position:absolute;left:0;right:0;bottom:calc(100% + 8px);height:0;pointer-events:none;z-index:4}
.mvcb{position:absolute;bottom:0;max-width:min(300px,70vw);transform:translateX(-50%);display:flex;gap:7px;align-items:flex-start;
  background:color-mix(in srgb,var(--panel) 92%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border:1px solid var(--line);border-radius:14px 14px 14px 4px;padding:7px 10px 7px 7px;box-shadow:0 10px 30px -12px rgb(0 0 0/.6);
  font:500 13px/1.35 var(--body);color:var(--fg);animation:mvcin .22s cubic-bezier(.2,.9,.3,1.2) both;pointer-events:auto;cursor:pointer}
.mvcb.out{animation:mvcout .4s ease forwards}
.mvcb small{display:block;color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.mvcb .t{overflow-wrap:anywhere}
.mvav{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 11px var(--body);color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent-2,var(--accent)))}
@keyframes mvcin{from{opacity:0;transform:translate(-50%,8px) scale(.92)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
@keyframes mvcout{to{opacity:0;transform:translate(-50%,-6px)}}
/* the markers become little avatars along the bottom of the waveform */
#pbar #pmks{position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none}#pmks .mk{all:unset;pointer-events:auto;position:absolute;bottom:-9px;width:16px;height:16px;margin-left:-8px;border-radius:50%;cursor:pointer;
  background:linear-gradient(135deg,var(--accent),var(--accent-2,var(--accent)));box-shadow:0 0 0 2px var(--panel);z-index:3;transition:transform .15s}
#pmks .mk:after{content:"M";display:grid;place-items:center;height:100%;font:700 8.5px var(--body);color:#fff}
#pmks .mk:hover,#pmks .mk.live{transform:scale(1.35)}
.dock.np #pmks .mk{box-shadow:0 0 0 2px var(--bg)}
/* write a comment, right under the waveform */
#mvcf{display:none;align-items:center;gap:8px;margin:12px 0 2px}
.dock.np #mvcf{display:flex}
@media (min-width:641px){#mvcf{display:flex}}
#mvcf input{flex:1;min-width:0;background:var(--panel2,var(--chip));border:1px solid var(--line);border-radius:999px;color:var(--fg);font:14px var(--body);padding:9px 14px}
#mvcf input:focus{outline:none;border-color:var(--accent)}
#mvcf button{border:0;background:var(--accent);color:var(--accent-fg,#fff);border-radius:999px;padding:9px 14px;font:600 13px var(--body);cursor:pointer}
#mvcf button:disabled{opacity:.45}
#mvcf .n{color:var(--muted);font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}
.dock.np #mvcf{order:2}
/* the old marker typing row is replaced by the box above */
.pxrow:has(#pmkt) #pmkt,.pxrow:has(#pmkt) #pmka{display:none}`;

  const marks = () => { const k = g('nowKey'), v = g('nowV'), nn = g('normName'); if (!k || !v) return []; const cur = nn ? nn(v.name) : v.name; return ((g('noteOf')?.(k) || {}).marks || []).filter(m => !m.v || m.v === cur); };
  const initial = m => (m.by || 'M').trim()[0]?.toUpperCase() || 'M';

  function bubble(m, ms = 4500){
    const d = audio.duration || 0; if (!d || !layer) return;
    const key = m.t + '|' + m.text; if (shown.has(key)) { clearTimeout(shown.get(key).t); shown.get(key).t = setTimeout(() => hide(key), ms); return; }
    const el = document.createElement('div'); el.className = 'mvcb';
    const pct = Math.max(6, Math.min(94, m.t / d * 100)); el.style.left = pct + '%';
    el.innerHTML = `<span class="mvav" aria-hidden="true">${h(initial(m))}</span><span><small>${fmt(m.t)}</small><span class="t">${h(m.text)}</span></span>`;
    el.onclick = () => { audio.currentTime = m.t; };
    // keep bubbles from sitting on top of each other
    const n = layer.children.length; el.style.bottom = (n * 46) + 'px';
    layer.append(el);
    const bw = bar.clientWidth, ew = el.offsetWidth, x = Math.max(ew / 2 - 4, Math.min(bw - ew / 2 + 4, m.t / d * bw)); el.style.left = x + 'px';
    shown.set(key, {el, t: setTimeout(() => hide(key), ms)});
    bar.querySelectorAll('#pmks .mk').forEach(b => b.classList.toggle('live', +b.dataset.mt === m.t));
  }
  function hide(key){ const s = shown.get(key); if (!s) return; shown.delete(key); s.el.classList.add('out'); setTimeout(() => { s.el.remove(); restack(); }, 400); bar.querySelectorAll('#pmks .mk.live').forEach(b => b.classList.remove('live')); }
  const restack = () => [...layer.children].forEach((c, i) => c.style.bottom = (i * 46) + 'px');
  function clearAll(){ for (const k of [...shown.keys()]) { clearTimeout(shown.get(k).t); shown.get(k).el.remove(); shown.delete(k); } }

  function tick(){
    const t = audio.currentTime || 0;
    if (!audio.paused && t >= lastT && t - lastT < 1.5) for (const m of marks()) if (m.t > lastT && m.t <= t + 0.05) bubble(m);
    paintMarks();
    lastT = t; const n = $('mvcfn'); if (n) n.textContent = 'at ' + fmt(t);
  }
  function paintMarks(){
    const box = $('pmks'), d = audio.duration || 0; if (!box || !d) return; const ms = marks();
    if (box.children.length === ms.length) return;
    box.innerHTML = ms.map(m => `<button class="mk" type="button" style="left:${m.t / d * 100}%" title="${h(fmt(m.t) + ' · ' + m.text)}" data-mt="${m.t}" aria-label="Comment: ${h(m.text)}"></button>`).join('');
  }
  function post(){
    const inp = $('mvcfi'), text = inp.value.trim(); if (!text || !g('nowKey')) return;
    // goes through the app's own marker save, so email/copy notes and the list keep working
    const mk = $('pmkt'), add = $('pmka'); if (!mk || !add) return;
    mk.value = text; add.click(); inp.value = ''; $('mvcfb').disabled = true;
    setTimeout(() => bubble({t: Math.round(audio.currentTime * 10) / 10, text}, 3500), 120);
  }

  function mount(){
    audio = $('audio'); bar = $('pbar'); const seek = bar?.closest('.seek'); if (!audio || !seek) return;
    const s = document.createElement('style'); s.textContent = css; document.head.append(s);
    layer = document.createElement('div'); layer.id = 'mvcl'; layer.setAttribute('aria-live', 'polite'); bar.append(layer);
    form = document.createElement('div'); form.id = 'mvcf';
    form.innerHTML = `<span class="mvav" aria-hidden="true">M</span><input id="mvcfi" type="text" maxlength="200" placeholder="Write a comment…" aria-label="Comment at this spot in the song" enterkeyhint="send"><span class="n" id="mvcfn">at 0:00</span><button type="button" id="mvcfb" disabled>Post</button>`;
    (document.getElementById('ptrimrow') || seek).after(form);
    $('mvcfi').addEventListener('input', e => { $('mvcfb').disabled = !e.target.value.trim(); });
    $('mvcfi').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); post(); } e.stopPropagation(); });
    $('mvcfb').onclick = post;
    audio.addEventListener('timeupdate', tick);
    audio.addEventListener('seeked', () => { lastT = audio.currentTime; });
    audio.addEventListener('loadedmetadata', () => { clearAll(); lastT = 0; });
    // hover / tap a marker avatar to read it
    bar.addEventListener('pointerover', e => { const b = e.target.closest('#pmks .mk'); if (!b) return; const m = marks().find(x => x.t === +b.dataset.mt); m && bubble(m, 2500); });
  }
  const wait = setInterval(() => { if ($('pbar') && $('audio') && g('songs')) { clearInterval(wait); mount(); } }, 400);
  window.__mvComments = {bubble, marks};
})();
