/* Maj Vault / Maj Clients: fold songs that are really the same song.
   "Maj - Feel The Love", "Maj - Feel The Love extended", "Cici Spirit Maj - Feel The Love" → one song, three versions.
   Copyright (c) 2026 Adil Majarali. All rights reserved. */
(() => {
  'use strict';
  const g = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
  const MON = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/;
  const GEN = new Set(['beat', 'beats', 'song', 'idea', 'hook', 'verse', 'freestyle', 'snippet', 'intro', 'outro', 'track', 'untitled', 'new', 'test', 'vocals', 'vox', 'demo', 'session', 'ref', 'mix', 'master', 'audio', 'recording', 'voice', 'memo']);
  const NOMERGE = 'mv-nomerge';
  const blocked = () => { try { return new Set(JSON.parse(localStorage.getItem(NOMERGE) || '[]')); } catch (_) { return new Set(); } };

  // the song's own name, without who's on it ("kla x maj mr sicko" → "mr sicko")
  function titleWords(k){
    const t = k.split(' '), idx = t.map((w, i) => ['x', 'maj', 'ft', 'feat', 'w'].includes(w) ? i : -1).filter(i => i >= 0);
    const rest = idx.length ? (t.slice(idx[idx.length - 1] + 1).length ? t.slice(idx[idx.length - 1] + 1) : t.slice(0, idx[0])) : t;
    return rest.filter(w => w !== 'x' && w !== 'maj');
  }
  function hasTitle(k){
    if (MON.test(k)) return false;                 // date-named songs ("MAJ - JAN 12") stay apart on purpose
    const t = titleWords(k), s = t.join('');
    if (t.length === 1 && GEN.has(t[0])) return false;
    return s.length >= 5 || (t.length >= 2 && s.length >= 4);
  }
  function lev(a, b){
    if (Math.abs(a.length - b.length) > 2) return 9;
    let p = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[b.length];
  }

  window.mvMergeLog = [];
  window.mvRegroup = function(){
    const songs = g('songs'), notes = g('notes'); if (!songs || songs.size < 2) return;
    const no = blocked(), byRole = new Map();
    for (const k of songs.keys()) { const i = k.indexOf('|'), role = k.slice(0, i); (byRole.get(role) || byRole.set(role, []).get(role)).push(k.slice(i + 1)); }
    const parent = new Map(), find = k => { while (parent.has(k)) k = parent.get(k); return k; };
    const weight = k => { const n = notes?.get?.(k); return (n ? 10 : 0) - k.length / 100; };   // keep the key that has your notes, else the shortest
    const link = (a, b) => { a = find(a); b = find(b); if (a === b || no.has(a + '>' + b) || no.has(b + '>' + a)) return; const [keep, drop] = weight(a) >= weight(b) ? [a, b] : [b, a]; parent.set(drop, keep); };
    for (const [role, keys] of byRole) {
      const ks = [...new Set(keys)].sort((a, b) => a.length - b.length);
      for (const a of ks) {
        if (!a || !hasTitle(a)) continue;
        const pre = [], suf = [];
        for (const b of ks) { if (b === a || b.length <= a.length) continue; if (b.startsWith(a + ' ')) pre.push(b); else if (b.endsWith(' ' + a)) suf.push(b); }
        if (pre.length >= 3) continue;           // a name lots of songs start with is an artist/prefix, not one song
        for (const b of pre) { if (!MON.test(b.slice(a.length))) link(role + '|' + a, role + '|' + b); }
        if (titleWords(a).length >= 2) for (const b of suf) { if (!MON.test(b.slice(0, -a.length))) link(role + '|' + a, role + '|' + b); }
      }
      // typos: long names one or two letters apart ("gonz lez" / "gonza lez")
      const long = ks.filter(k => k.length >= 14 && hasTitle(k));
      for (let i = 0; i < long.length; i++) for (let j = i + 1; j < long.length; j++) {
        const a = long[i], b = long[j]; if (b.length - a.length > 2) break;
        if (lev(a, b) <= (a.length >= 24 ? 2 : 1) && a.replace(/\D/g, '') === b.replace(/\D/g, '')) link(role + '|' + a, role + '|' + b);
      }
    }
    for (const drop of parent.keys()) {
      const keep = find(drop), s = songs.get(drop), t = songs.get(keep); if (!s || !t) continue;
      for (const v of s.versions) { v.mergedFrom = s.title; t.versions.push(v); }
      window.mvMergeLog.push({keep, drop, from: s.title, into: t.title});
      songs.delete(drop);
    }
  };
  // undo for one song: split the names that were folded in (remembered on this device)
  window.mvUnmerge = function(keep){
    const log = window.mvMergeLog.filter(m => m.keep === keep);
    try { const s = blocked(); log.forEach(m => s.add(m.keep + '>' + m.drop)); localStorage.setItem(NOMERGE, JSON.stringify([...s])); } catch (_) {}
    return log.length;
  };
})();
(() => {
  // a small "Split" chip on songs that were folded together, in case one shouldn't be
  const css = document.createElement('style'); css.textContent = '.mv-merged{border:1px dashed var(--line);background:none;color:var(--muted);border-radius:999px;padding:4px 10px;font:500 12px var(--body);cursor:pointer;margin-left:6px}.mv-merged:hover{color:var(--fg);border-color:var(--accent)}'; document.head.append(css);
  const add = () => { for (const o of document.querySelectorAll('.org2[data-org]')) { if (o.querySelector('.mv-merged')) continue; const k = o.dataset.org, n = (window.mvMergeLog || []).filter(m => m.keep === k); if (!n.length) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mv-merged'; b.textContent = `Joined ${n.length + 1} names · Split`; b.title = 'Joined because the names match: ' + n.map(m => '“' + m.from + '”').join(', ') + '. Tap to keep them as separate songs.';
    b.onclick = e => { e.stopPropagation(); if (!confirm(`Keep these as separate songs?\n\n${n.map(m => '• ' + m.from).join('\n')}`)) return; window.mvUnmerge(k); location.reload(); };
    const slot = o.querySelector('.o2chips, .o2mid') || o; slot.append(b); } };
  new MutationObserver(() => { clearTimeout(add.t); add.t = setTimeout(add, 150); }).observe(document.documentElement, {childList: true, subtree: true});
})();
(() => {
  // lyrics: a thin quick transcript (a few lines) gets a deeper second pass once
  window.mvThin = x => !!x && x.src === 'groq' && !x.deep && !x.none && (x.l?.length || 0) < 8;
  // before transcribing, lean the audio towards the voice: cut the 808/kick rumble and the hi-hat fizz
  window.mvVoxFocus = async a => {
    try {
      const ac = new OfflineAudioContext(1, a.length, 16000), b = ac.createBuffer(1, a.length, 16000); b.copyToChannel(a, 0);
      const s = ac.createBufferSource(); s.buffer = b;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140; hp.Q.value = 0.7;
      const hp2 = ac.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 140; hp2.Q.value = 0.7;
      const pk = ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2500; pk.gain.value = 3; pk.Q.value = 0.8;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      s.connect(hp).connect(hp2).connect(pk).connect(lp).connect(ac.destination); s.start();
      const o = (await ac.startRendering()).getChannelData(0);
      let pk2 = 0; for (let i = 0; i < o.length; i++) { const v = Math.abs(o[i]); if (v > pk2) pk2 = v; }
      if (pk2 > 0) { const gn = 0.89 / pk2; for (let i = 0; i < o.length; i++) o[i] *= gn; }
      return o;
    } catch (_) { return a; }
  };
})();
