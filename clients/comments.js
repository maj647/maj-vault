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
    el.innerHTML = `<span class="mvav" aria-hidden="true">${h(initial(m))}</span><span><small>${fmt(m.t)}${m.lt ? ' · “' + h(m.lt.length > 34 ? m.lt.slice(0, 34) + '…' : m.lt) + '”' : ''}</small><span class="t">${h(m.text)}</span></span>`;
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
/* comments on the lyrics themselves: tap 💬 on any line, the note is pinned to that line (and its spot in the song) */
(() => {
  'use strict';
  const g = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
  const $ = id => document.getElementById(id);
  const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const css = document.createElement('style'); css.textContent = `
.lcb{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:3px;margin-left:8px;padding:2px 7px;border-radius:999px;font:600 11.5px var(--body);color:var(--muted);vertical-align:middle;opacity:.55;transition:opacity .15s,background .15s}
.lcb:hover,.lcb:focus-visible,.lcb.has{opacity:1}.lcb.has{background:var(--accent-soft);color:var(--fg)}
.lfl:hover .lcb,.ll:hover .lcb{opacity:1}
.lcs{display:flex;flex-direction:column;gap:6px;margin:6px 0 10px;font:500 13.5px/1.35 var(--body);text-align:left}
.lfl .lcs{font-size:14px}
.lc{display:flex;gap:8px;align-items:flex-start;background:color-mix(in srgb,var(--panel) 88%,transparent);border:1px solid var(--line);border-radius:14px 14px 14px 4px;padding:7px 10px 7px 7px;width:max-content;max-width:100%;color:var(--fg);animation:lcin .25s ease both}
.lc .mvav{width:20px;height:20px;font-size:10px;flex:none}
.lc .x{all:unset;cursor:pointer;color:var(--muted);margin-left:6px;font-size:13px}
.lc small{color:var(--muted);font-size:11px;margin-left:6px}
.lci{display:flex;gap:6px;margin:6px 0 10px}.lci input{flex:1;min-width:0;background:var(--panel2,var(--chip));border:1px solid var(--line);border-radius:999px;color:var(--fg);font:14px var(--body);padding:8px 12px}
.lci button{border:0;background:var(--accent);color:var(--accent-fg,#fff);border-radius:999px;padding:8px 12px;font:600 12.5px var(--body);cursor:pointer}
/* in full-screen lyrics: a line's comments pop in when the song reaches it */
#lfbody .lfl .lcs{max-height:0;overflow:hidden;opacity:0;margin:0;transition:max-height .35s,opacity .35s,margin .35s}
#lfbody .lfl.cur .lcs,#lfbody .lfl .lcs.open{max-height:400px;opacity:1;margin:6px 0 10px}
/* inside a song's Lyrics tab */
.lyrp .ll{grid-template-columns:52px 1fr auto!important}.lyrp .ll .lcb{margin:0}.lyrp .ll .lcs,.lyrp .ll .lci{grid-column:2/-1;margin-top:2px}
@keyframes lcin{from{opacity:0;transform:translateY(4px)}}`;
  document.head.append(css);

  const all = k => ((g('noteOf')?.(k) || {}).marks || []);
  const forLine = (k, txt, t) => { const n = norm(txt); return all(k).filter(m => (m.lt && norm(m.lt) === n) || (m.line != null && Math.abs(m.t - t) < 0.35)); };
  function save(k, t, txt, text){
    const ms = [...all(k), {t: Math.round(t * 10) / 10, text, lt: txt, line: 1, at: new Date().toISOString().slice(0, 16)}].sort((a, b) => a.t - b.t);
    g('writeNote')?.(k, {marks: ms});
  }
  function remove(k, m){ g('writeNote')?.(k, {marks: all(k).filter(x => !(x.t === m.t && x.text === m.text && x.at === m.at))}); }
  const fullKey = () => { const tt = $('lftitle')?.textContent || ''; for (const [k, s] of g('songs') || []) if ((s.plate || s.title) === tt) return k; return g('nowKey'); };

  // one line: its button, its comments
  function decorate(line, k, t, txt, isFull){
    let b = line.querySelector(':scope > .lcb'), list = line.querySelector(':scope > .lcs');
    const ms = forLine(k, txt, t), sig = ms.map(m => m.at + m.text).join('|');
    if (b && b.dataset.sig === sig) return;
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'lcb'; b.setAttribute('aria-label', 'Comment on this line'); line.append(b); }
    b.dataset.sig = sig; b.classList.toggle('has', ms.length > 0); b.innerHTML = '💬' + (ms.length ? ' ' + ms.length : '');
    b.onclick = e => { e.stopPropagation(); e.preventDefault(); open(line, k, t, txt); };
    if (!ms.length) { list?.remove(); return; }
    if (!list) { list = document.createElement('div'); list.className = 'lcs'; line.append(list); }
    list.innerHTML = ms.map((m, i) => `<div class="lc"><span class="mvav" aria-hidden="true">${h((m.by || 'M')[0].toUpperCase())}</span><span>${h(m.text)}<small>${fmt(m.t)}</small></span><button type="button" class="x" data-i="${i}" aria-label="Delete comment">×</button></div>`).join('');
    list.onclick = e => { e.stopPropagation(); const x = e.target.closest('.x'); if (x) { remove(k, ms[+x.dataset.i]); setTimeout(scan, 80); } };
  }
  function open(line, k, t, txt){
    document.querySelectorAll('.lci').forEach(f => f.remove());
    const f = document.createElement('div'); f.className = 'lci';
    f.innerHTML = `<input type="text" maxlength="200" placeholder="Comment on “${h(txt.slice(0, 40))}${txt.length > 40 ? '…' : ''}”" enterkeyhint="send"><button type="button">Post</button>`;
    line.append(f); line.querySelector('.lcs')?.classList.add('open');
    const inp = f.querySelector('input'); inp.focus();
    const go = () => { const v = inp.value.trim(); if (v) { save(k, t, txt, v); window.__mvComments?.bubble?.({t, text: v}, 3500); } f.remove(); setTimeout(scan, 80); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); go(); } if (e.key === 'Escape') f.remove(); });
    f.querySelector('button').onclick = e => { e.stopPropagation(); go(); };
    f.addEventListener('click', e => e.stopPropagation());
  }
  function scan(){
    // full-screen lyrics
    const fb = $('lfbody');
    if (fb && !$('lyrfull')?.hidden) { const k = fullKey(); if (k) for (const p of fb.querySelectorAll('.lfl')) { const w = p.querySelector('.w'); const t = w ? +w.dataset.t : 0; const txt = [...p.querySelectorAll('.w')].map(x => x.textContent).join(' '); decorate(p, k, t, txt, true); } }
    // the lyrics tab inside a song
    for (const row of document.querySelectorAll('.lyrp .ll')) { const lt = row.querySelector('.lt'), lx = row.querySelector('.lx'); if (!lt || !lx) continue; decorate(row, lt.dataset.lplay, +lt.dataset.at, lx.textContent, false); }
  }
  let q = 0; const soon = () => { clearTimeout(q); q = setTimeout(scan, 120); };
  new MutationObserver(muts => { for (const m of muts) { if (m.target.closest?.('.lcs,.lci,.lcb')) continue; for (const n of m.addedNodes) if (n.nodeType === 1 && !n.closest?.('.lcs,.lci') && !n.classList?.contains('lcb')) return soon(); } }).observe(document.documentElement, {childList: true, subtree: true});
  addEventListener('focus', soon);
  window.__mvLyrComments = {scan};
})();
