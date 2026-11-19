/* Maj CRM: clients, bookings, deliveries and the AI audio engineer, inside Maj Vault and Maj Clients.
   Copyright (c) 2026 Adil Majarali. All rights reserved.
   One record shared by both apps, kept in the app's private Google Drive space (maj-crm.json). */
(() => {
  'use strict';
  const FILE = 'maj-crm.json', DRV = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const g = name => { try { return (0, eval)(name); } catch (_) { return undefined; } };   // the app's own globals (songs, noteOf, …)
  const uidv = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const isoToday = () => new Date().toISOString().slice(0, 10);
  const money = n => '$' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-CA', {minimumFractionDigits: (+n || 0) % 1 ? 2 : 0, maximumFractionDigits: 2});
  const day = d => { if (!d) return ''; const x = new Date(d.length <= 10 ? d + 'T12:00' : d); return isNaN(x) ? d : x.toLocaleDateString('en-CA', {month: 'short', day: 'numeric', year: x.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'}); };
  const toast = m => { const t = g('toast'); t ? t(m) : console.log(m); };

  /* ---------- storage ---------- */
  let doc = {clients: {}, bookings: [], tasks: [], updated: ''}, fileId = null, loaded = false, saving = null;
  const LS = 'mv-crm';
  try { const s = localStorage.getItem(LS); if (s) doc = {...doc, ...JSON.parse(s)}; } catch (_) {}
  const gf = (u, o) => window.MV?.gfetch ? window.MV.gfetch(u, o) : Promise.reject({message: 'Sign in to Google first'});
  async function load(){
    if (!window.MV?.gfetch) return;
    try {
      const r = await gf(`${DRV}/files?spaces=appDataFolder&q=${encodeURIComponent(`name = '${FILE}'`)}&fields=files(id,modifiedTime)`);
      fileId = r.files?.[0]?.id || null;
      if (fileId) { const tok = await gf(`${DRV}/files/${fileId}?alt=media`); if (tok && (tok.updated || '') >= (doc.updated || '')) doc = {clients: {}, bookings: [], tasks: [], ...tok}; else if (tok) save(); }
      loaded = true; keepLocal(); if (isOpen()) render();
    } catch (e) { console.warn('crm load', e); }
  }
  const keepLocal = () => { try { localStorage.setItem(LS, JSON.stringify(doc)); } catch (_) {} };
  function save(){
    doc.updated = new Date().toISOString(); keepLocal();
    clearTimeout(save.t); save.t = setTimeout(flush, 600);
  }
  async function flush(){
    if (!window.MV?.gfetch) return;
    const body = new Blob([JSON.stringify(doc)], {type: 'application/json'});
    try {
      if (saving) await saving;
      saving = (async () => {
        if (fileId) return gf(`${UP}/files/${fileId}?uploadType=media`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body});
        const f = new FormData(); f.append('metadata', new Blob([JSON.stringify({name: FILE, parents: ['appDataFolder']})], {type: 'application/json'})); f.append('file', body);
        const r = await gf(`${UP}/files?uploadType=multipart&fields=id`, {method: 'POST', body: f}); fileId = r.id;
      })();
      await saving;
    } catch (e) { toast('CRM not saved to Drive yet: ' + (e?.message || e?.code || 'error') + '. It’s kept on this device.'); }
    finally { saving = null; }
  }

  /* ---------- the model: clients from your files + contacts + what you add ---------- */
  const norm = e => String(e || '').trim().toLowerCase();
  const isMail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
  const ME = () => norm(window.MV_EMAIL || g('ACCT') || '');
  function model(){
    const songs = g('songs') || new Map(), clientsIdx = g('clientsIdx'), noteOf = g('noteOf'), nick = g('nick') || (() => '');
    const cl = new Map(), byMail = new Map();
    const put = (id, o) => { const c = cl.get(id) || {id, name: '', emails: new Set(), songs: new Set(), auto: true}; Object.assign(c, {...o, emails: c.emails, songs: c.songs}); (o.emails || []).forEach(e => { e = norm(e); if (isMail(e) && e !== ME()) { c.emails.add(e); byMail.has(e) || byMail.set(e, id); } }); (o.songs || []).forEach(k => c.songs.add(k)); cl.set(id, c); return c; };
    if (clientsIdx && clientsIdx.size) for (const c of clientsIdx.values()) put('a:' + c.key, {name: c.name, emails: [...c.emails.keys()], songs: c.songs});
    let approved = new Set(); try { approved = g('approvedSet')(); } catch (_) {}
    let hist = []; try { hist = g('contacts')() || []; } catch (_) {}
    const hm = new Map(hist.map(x => [x.email, x]));
    for (const e of new Set([...approved, ...hist.filter(x => x.sent > 0).map(x => x.email)])) {
      const em = norm(e); if (!isMail(em) || em === ME()) continue;
      if (byMail.has(em)) { const c = cl.get(byMail.get(em)); (hm.get(em)?.songs || []).forEach(k => c.songs.add(k)); continue; }
      put('e:' + em, {name: nick(em) || em.split('@')[0], emails: [em], songs: [...(hm.get(em)?.songs || [])]});
    }
    // your edits win: names, merges, extra emails, manual clients, hidden ones
    for (const [id, o] of Object.entries(doc.clients || {})) {
      if (o.into && cl.has(o.into) && cl.has(id)) { const a = cl.get(id), b = cl.get(o.into); a.emails.forEach(e => { b.emails.add(e); byMail.set(e, b.id); }); a.songs.forEach(k => b.songs.add(k)); cl.delete(id); continue; }
      if (!cl.has(id) && !id.startsWith('m:')) continue;
      const c = put(id, {name: o.name || cl.get(id)?.name || 'Client', emails: o.emails || []}); c.auto = !id.startsWith('m:'); c.info = o;
    }
    for (const c of cl.values()) c.info = c.info || doc.clients?.[c.id] || {};
    // deliveries (what you sent) and what came in
    const out = [], inn = [];
    for (const [k, s] of songs) {
      const seen = new Set();
      for (const v of s.versions || []) {
        if (v.src !== 'G' || !v.who) continue;
        const to = v.who.startsWith('→'), list = String(v.who).replace(/^[→←]\s*/, '').split(/,\s*/).map(norm).filter(isMail);
        for (const e of list) { const row = {k, song: s.title, file: v.name, at: (v.date || '').slice(0, 16), email: e, v}; (to ? out : inn).push(row); to && seen.add(e + (v.date || '').slice(0, 10)); }
      }
      const n = noteOf ? noteOf(k) : null;
      for (const l of n?.sentLog || []) for (const e of l.to || []) { const em = norm(e); if (seen.has(em + (l.at || '').slice(0, 10))) continue; for (const f of l.files || ['']) out.push({k, song: s.title, file: f, at: l.at || '', email: em, app: true}); }
    }
    out.sort((a, b) => b.at.localeCompare(a.at)); inn.sort((a, b) => b.at.localeCompare(a.at));
    const who = e => byMail.get(e);
    for (const c of cl.values()) { c.out = []; c.inn = []; c.last = ''; }
    for (const r of out) { const c = cl.get(who(r.email)); if (c) { c.out.push(r); c.songs.add(r.k); if (r.at > c.last) c.last = r.at; } }
    for (const r of inn) { const c = cl.get(who(r.email)); if (c) { c.inn.push(r); c.songs.add(r.k); if (r.at > c.last) c.last = r.at; } }
    for (const c of cl.values()) {
      c.bookings = (doc.bookings || []).filter(b => b.client === c.id);
      c.tasks = (doc.tasks || []).filter(t => t.client === c.id);
      c.owed = c.bookings.filter(b => b.status !== 'cancelled' && b.status !== 'hold' && (b.date <= isoToday() || b.status === 'done' || +b.paid > 0)).reduce((s, b) => s + bookTotal(b) - (+b.paid || 0), 0);
      c.waiting = c.inn[0] && c.inn[0].at >= new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10) && (!c.out[0] || c.inn[0].at > c.out[0].at) ? c.inn[0] : null;
      for (const b of c.bookings) if (b.date > c.last.slice(0, 10) && b.date <= isoToday()) c.last = b.date;
    }
    const list = [...cl.values()].filter(c => !c.info.hidden).sort((a, b) => (b.last || '').localeCompare(a.last || '') || a.name.localeCompare(b.name));
    return {cl, list, out, inn, byMail, songs};
  }
  const bookTotal = b => b.flat ? +b.flat || 0 : (+b.hours || 0) * (+b.rate || 0);
  const clientName = (m, id) => m.cl.get(id)?.name || doc.clients?.[id]?.name || 'No client';

  /* ---------- the AI audio engineer: a real mix/master check ---------- */
  function biquad(x, b0, b1, b2, a1, a2){ const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; } return y; }
  function kWeight(x, fs){
    let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196, K = Math.tan(Math.PI * f0 / fs), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416), a0 = 1 + K / Q + K * K;
    let y = biquad(x, (Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
    f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / fs); a0 = 1 + K / Q + K * K;
    return biquad(y, 1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
  }
  function lufs(chs, fs){
    const w = chs.map(c => kWeight(c, fs)), blk = Math.round(0.4 * fs), hop = Math.round(0.1 * fs), z = [];
    for (let s = 0; s + blk <= w[0].length; s += hop) { let sum = 0; for (const c of w) { let a = 0; for (let i = s; i < s + blk; i++) a += c[i] * c[i]; sum += a / blk; } z.push(sum); }
    const L = v => -0.691 + 10 * Math.log10(v), abs = z.filter(v => L(v) > -70); if (!abs.length) return {i: -Infinity, st: -Infinity};
    const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10, gated = abs.filter(v => L(v) > rel);
    // loudest 3 s (short-term max)
    let st = -Infinity; const n3 = 30; for (let i = 0; i + n3 <= z.length; i += 5) { let a = 0; for (let j = i; j < i + n3; j++) a += z[j]; st = Math.max(st, L(a / n3)); }
    // loudness range (10th–95th percentile of 3 s windows)
    const sts = []; for (let i = 0; i + n3 <= z.length; i += 10) { let a = 0; for (let j = i; j < i + n3; j++) a += z[j]; const l = L(a / n3); if (l > -70) sts.push(l); }
    const sr = sts.filter(l => l > L(sts.reduce((a, l2) => a + Math.pow(10, (l2 + 0.691) / 10), 0) / Math.max(1, sts.length)) - 20).sort((a, b) => a - b);
    const lra = sr.length > 3 ? sr[Math.floor(sr.length * 0.95) - 1] - sr[Math.floor(sr.length * 0.1)] : 0;
    return {i: L(gated.reduce((a, b) => a + b, 0) / gated.length), st, lra};
  }
  const db = v => v > 0 ? 20 * Math.log10(v) : -Infinity, r1 = v => isFinite(v) ? Math.round(v * 10) / 10 : '−∞';
  function onePoleLP(x, fc, fs){ const a = Math.exp(-2 * Math.PI * fc / fs), y = new Float32Array(x.length); let p = 0; for (let i = 0; i < x.length; i++) { p = (1 - a) * x[i] + a * p; y[i] = p; } return y; }
  async function analyse(bytes){
    const ac = new OfflineAudioContext(2, 44100, 44100), buf = await ac.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const fs = buf.sampleRate, n = buf.length, chs = [...Array(Math.min(2, buf.numberOfChannels))].map((_, i) => buf.getChannelData(i));
    let peak = 0, clips = 0, run = 0, dc = [0, 0], tp = 0;
    chs.forEach((c, ci) => { let s = 0; for (let i = 0; i < n; i++) { const a = Math.abs(c[i]); if (a > peak) peak = a; s += c[i]; if (a >= 0.9995) { if (++run === 3) clips++; } else run = 0; } dc[ci] = s / n; });
    // true peak: 4x Catmull-Rom between loud samples
    const thr = peak * 0.7;
    for (const c of chs) for (let i = 1; i < n - 2; i++) { if (Math.abs(c[i]) < thr && Math.abs(c[i + 1]) < thr) continue; const p0 = c[i - 1], p1 = c[i], p2 = c[i + 1], p3 = c[i + 2]; for (let k = 1; k < 4; k++) { const t = k / 4, v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); if (Math.abs(v) > tp) tp = Math.abs(v); } }
    tp = Math.max(tp, peak);
    const L = chs[0], R = chs[1] || chs[0], mid = new Float32Array(n); let ll = 0, rr = 0, lr = 0, ss = 0, mm = 0, same = true;
    for (let i = 0; i < n; i++) { const l = L[i], r = R[i]; ll += l * l; rr += r * r; lr += l * r; mid[i] = (l + r) / 2; mm += mid[i] * mid[i]; const sd = (l - r) / 2; ss += sd * sd; if (same && Math.abs(l - r) > 1e-4) same = false; }
    const corr = ll && rr ? lr / Math.sqrt(ll * rr) : 1, rms = Math.sqrt((ll + rr) / (2 * n));
    const low = onePoleLP(onePoleLP(mid, 150, fs), 150, fs), lowL = onePoleLP(onePoleLP(L, 150, fs), 150, fs), lowR = onePoleLP(onePoleLP(R, 150, fs), 150, fs);
    const lowMid = onePoleLP(onePoleLP(mid, 5000, fs), 5000, fs);
    let eLow = 0, eHigh = 0, lc = 0, la = 0, lb = 0;
    for (let i = 0; i < n; i++) { eLow += low[i] * low[i]; const hi = mid[i] - lowMid[i]; eHigh += hi * hi; lc += lowL[i] * lowR[i]; la += lowL[i] * lowL[i]; lb += lowR[i] * lowR[i]; }
    const lowCorr = la && lb ? lc / Math.sqrt(la * lb) : 1;
    const thrS = Math.pow(10, -60 / 20); let st = 0, en = n - 1; while (st < n && Math.abs(L[st]) < thrS && Math.abs(R[st]) < thrS) st++; while (en > 0 && Math.abs(L[en]) < thrS && Math.abs(R[en]) < thrS) en--;
    const ld = lufs(chs, fs);
    return {sr: fs, ch: buf.numberOfChannels, dur: n / fs, peak: db(peak), tp: db(tp), clips, dc: Math.max(Math.abs(dc[0]), Math.abs(dc[1] || 0)), lufs: ld.i, stmax: ld.st, lra: ld.lra, plr: db(tp) - ld.i, rmsDb: db(rms),
      corr, side: mm ? ss / mm : 0, lowCorr: la > 1e-7 * n ? lowCorr : 1, mono: same && buf.numberOfChannels > 1, tone: mm > 0.05 * (ll + rr) / 2, lowShare: mm ? eLow / mm : 0, highShare: mm ? eHigh / mm : 0, head: st / fs, tail: (n - 1 - en) / fs};
  }
  function findings(m){
    const f = [], add = (lvl, t, d) => f.push({lvl, t, d});
    const L = m.lufs;
    if (!isFinite(L)) { add('bad', 'Silent file', 'Nothing above −70 LUFS. Wrong export or an empty bounce.'); return f; }
    if (L > -7) add('warn', `Very loud master: ${r1(L)} LUFS`, `Streaming turns it down about ${r1(L + 14)} dB on Spotify/YouTube. Fine for a rap single if it still punches; if the drums feel flat, back the limiter off 1–2 dB.`);
    else if (L > -10) add('good', `Loud, competitive master: ${r1(L)} LUFS`, `Typical for rap/R&B releases. Spotify plays it ${r1(L + 14)} dB quieter.`);
    else if (L > -16) add('good', `Streaming-level loudness: ${r1(L)} LUFS`, 'Close to the −14 LUFS streaming reference, so nothing gets turned down much.');
    else add('warn', `Quiet: ${r1(L)} LUFS`, 'Reads as a mix, not a master. If this is the final, it will sound quieter than other songs in a playlist.');
    if (m.tp > -0.1) add('bad', `True peak over 0 dB (${r1(m.tp)} dBTP)`, 'Will distort on MP3/AAC and Bluetooth. Set the limiter ceiling to −1 dBTP (−0.3 at least for WAV-only).');
    else if (m.tp > -1) add('warn', `True peak ${r1(m.tp)} dBTP`, 'Streaming asks for −1 dBTP. Lower the ceiling a little before release.');
    else add('good', `Peaks safe (${r1(m.tp)} dBTP)`, '');
    if (m.clips > 0) add(m.clips > 20 ? 'bad' : 'warn', `${m.clips} clipped spot${m.clips === 1 ? '' : 's'}`, 'Runs of samples stuck at full scale. Check the master bus and the loudest vocals/808s.');
    if (m.plr < 6) add('warn', `Very squashed (peak-to-loudness ${r1(m.plr)} dB)`, 'Little room left for transients. Kicks and snares can lose their snap.');
    else if (m.plr > 16 && L < -14) add('warn', `Very dynamic (peak-to-loudness ${r1(m.plr)} dB)`, 'Unmastered or very open. Fine for a mix sent to mastering.');
    if (m.lra > 12) add('warn', `Big loudness jumps (range ${r1(m.lra)} LU)`, 'Some sections are much quieter than others. Check the intro/bridge levels.');
    if (m.mono) add('warn', 'Mono file', 'Left and right are identical. Was it exported in mono by mistake?');
    else if (m.corr < 0) add('bad', `Phase problem (correlation ${m.corr.toFixed(2)})`, 'Parts cancel in mono (phones, club PAs). Look for a flipped-polarity track or an extreme stereo widener.');
    else if (m.corr < 0.3) add('warn', `Very wide stereo (correlation ${m.corr.toFixed(2)})`, 'Can sound hollow in mono. Check wideners on the beat and the vocal stack.');
    if (!m.mono && m.lowCorr < 0.6) add('warn', 'Wide low end', `Bass below 150 Hz isn't centred (correlation ${m.lowCorr.toFixed(2)}). The 808/bass can disappear in mono or on a club system; mono the lows.`);
    if (m.tone === false) {} else if (m.lowShare > 0.8) add('warn', 'Very bass-heavy', `About ${Math.round(m.lowShare * 100)}% of the energy is below 150 Hz. Check on small speakers and the 808 vs kick balance.`);
    else if (m.lowShare < 0.2) add('warn', 'Thin low end', `Only ${Math.round(m.lowShare * 100)}% of the energy is below 150 Hz, light for rap/R&B.`);
    if (m.tone === false) {} else if (m.highShare < 0.004) add('warn', 'Dark top end', 'Very little above 5 kHz. Vocals may sound dull next to commercial songs.');
    else if (m.highShare > 0.12) add('warn', 'Bright / harsh top', 'A lot of energy above 5 kHz. Check sibilance (S sounds) and hi-hats.');
    if (m.dc > 0.002) add('warn', 'DC offset', 'The waveform is shifted off centre. A high-pass at 20 Hz or DC removal fixes it.');
    if (m.head > 2) add('warn', `${r1(m.head)} s of silence at the start`, 'Trim it so the song starts when it’s played.');
    if (m.tail > 6) add('warn', `${r1(m.tail)} s of silence at the end`, '');
    if (m.sr < 44100) add('warn', `Low sample rate (${m.sr} Hz)`, 'Export at 44.1 kHz or higher.');
    return f;
  }
  async function runQC(task){
    const m = model(), s = m.songs.get(task.song), v = s && (s.versions || []).find(x => x.name === task.file);
    if (!v) throw {message: 'that file isn’t in your list any more'};
    task.status = 'running'; task.note = 'Getting the file…'; render();
    const af = g('attachmentFor'), f = await af(v);
    task.note = 'Listening…'; render();
    await new Promise(r => setTimeout(r, 30));
    const met = await analyse(f.bytes);
    task.report = {met, find: findings(met), at: new Date().toISOString().slice(0, 16)};
    task.status = 'done'; task.note = ''; save(); render();
  }
  async function aiNotes(task){
    const k = g('aiKeys'); if (!k?.groq) { toast('Add your Groq key in AI helpers (✦) to get written engineer notes.'); return; }
    const m = task.report.met, prompt = `You are a senior mix and mastering engineer for rap and R&B. Write 4–6 short, specific, practical notes (plain text bullets, no intro) for the artist and engineer about this file "${task.file}". Measurements: integrated ${r1(m.lufs)} LUFS, short-term max ${r1(m.stmax)} LUFS, loudness range ${r1(m.lra)} LU, true peak ${r1(m.tp)} dBTP, peak-to-loudness ${r1(m.plr)} dB, clipped spots ${m.clips}, stereo correlation ${m.corr.toFixed(2)}, low-end (<150Hz) correlation ${m.lowCorr.toFixed(2)}, energy below 150Hz ${Math.round(m.lowShare * 100)}%, above 5kHz ${(m.highShare * 100).toFixed(1)}%, length ${Math.round(m.dur)} s. Purpose: ${task.purpose || 'release master'}. Never invent things you can't know from the numbers.`;
    task.note = 'Writing notes…'; render();
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + k.groq}, body: JSON.stringify({model: 'llama-3.3-70b-versatile', temperature: 0.3, max_tokens: 500, messages: [{role: 'user', content: prompt}]})});
      if (!r.ok) throw {message: 'Groq said ' + r.status};
      task.report.notes = (await r.json()).choices?.[0]?.message?.content?.trim() || ''; save();
    } catch (e) { toast('Couldn’t write notes: ' + (e?.message || 'error')); }
    task.note = ''; render();
  }

  /* ---------- UI ---------- */
  const KINDS = {qc: 'Mix / master check', stems: 'Split stems', lyrics: 'Lyrics', tempo: 'Tempo & key', studio: 'Studio edit', bounce: 'Bounce on the Mac', mix: 'Mix', master: 'Master', deliver: 'Deliver files', other: 'Other'};
  const STAT = {hold: 'Hold', booked: 'Booked', done: 'Done', paid: 'Paid', cancelled: 'Cancelled'};
  let view = 'today', open1 = null, form = null, dlg = null;
  const isOpen = () => dlg?.open;
  function css(){
    const s = document.createElement('style'); s.textContent = `
#crm *{box-sizing:border-box}
#crm{width:min(1100px,100vw);max-width:100vw;height:min(92vh,100dvh);max-height:100dvh;padding:0;border:1px solid var(--line);border-radius:18px;background:var(--bg);color:var(--fg);overflow:hidden}
#crm::backdrop{background:rgb(0 0 0/.55)}
@media (max-width:700px){#crm{width:100vw;height:100dvh;border-radius:0;border:0}}
#crm .q-ch{display:flex;align-items:center;gap:10px;padding:14px 16px 0}#crm .q-ch h2{margin:0;font:600 18px/1.2 var(--body);flex:1}
#crm .q-ct{display:flex;gap:4px;padding:10px 16px;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:none}
#crm .q-ct button{flex:none;border:0;background:none;color:var(--muted);font:500 14px var(--body);padding:8px 12px;border-radius:999px;cursor:pointer}
#crm .q-ct button.q-on{background:var(--accent-soft);color:var(--fg)}
#crm .q-cb{height:calc(100% - 104px);overflow:auto;padding:16px;-webkit-overflow-scrolling:touch}
#crm .q-x{border:0;background:var(--chip);color:var(--fg);width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer}
#crm .q-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:18px}
#crm .q-stat{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px}#crm .q-stat b{display:block;font:600 22px/1.1 var(--body)}#crm .q-stat span{color:var(--muted);font-size:12.5px}
#crm h3{font:600 13px var(--body);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:18px 0 8px}
#crm .q-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:6px}
#crm .q-row.q-btn{cursor:pointer;width:100%;text-align:left;color:inherit;font:inherit}#crm .q-row.q-btn:hover{border-color:var(--accent)}
#crm .q-row .q-grow{flex:1;min-width:0}#crm .q-row .q-grow b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#crm .q-row .q-grow small{color:var(--muted);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#crm .q-av{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--fg);font-weight:600}
#crm .q-pill{flex:none;font-size:11.5px;padding:3px 8px;border-radius:999px;background:var(--chip);color:var(--muted);white-space:nowrap}
#crm .q-pill.q-a{background:var(--amber-soft);color:var(--amber)}#crm .q-pill.q-g{background:var(--accent-soft);color:var(--fg)}#crm .q-pill.q-r{background:color-mix(in srgb,var(--danger) 18%,transparent);color:var(--danger)}
#crm .q-sb{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
#crm input,#crm select,#crm textarea{background:var(--panel2);color:var(--fg);border:1px solid var(--line);border-radius:10px;padding:9px 10px;font:14px var(--body);min-width:0}
#crm textarea{width:100%;min-height:70px;resize:vertical}
#crm .q-f{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
#crm .q-f label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted)}#crm .q-f .q-wide{grid-column:1/-1}
#crm .q-b{border:1px solid var(--line);background:var(--chip);color:var(--fg);border-radius:999px;padding:8px 14px;font:500 13.5px var(--body);cursor:pointer;white-space:nowrap}
#crm .q-b.q-p{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}#crm .q-b.q-s{padding:5px 10px;font-size:12.5px}#crm .q-b:disabled{opacity:.5}
#crm .q-empty{color:var(--muted);padding:14px 2px}
#crm .q-rep{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:6px 0 12px}
#crm .q-rep li{margin:6px 0;list-style:none;padding-left:22px;position:relative}#crm .q-rep li:before{content:"●";position:absolute;left:4px;font-size:10px;top:3px}
#crm .q-rep li.q-good:before{color:var(--live)}#crm .q-rep li.q-warn:before{color:var(--amber)}#crm .q-rep li.q-bad:before{color:var(--danger)}
#crm .q-rep small{color:var(--muted);display:block}#crm .q-meters{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
#crm .q-notes{white-space:pre-wrap;font-size:14px;border-top:1px solid var(--line);padding-top:8px;margin-top:8px}
#crm .q-two>div{min-width:0}#crm .q-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media (max-width:800px){#crm .q-two{grid-template-columns:1fr}}
#crmbtn{margin-left:auto;margin-right:8px;flex:none;border:1px solid var(--line);background:var(--chip);color:var(--fg);border-radius:999px;padding:7px 13px;font:600 12.5px var(--body);letter-spacing:.04em;cursor:pointer}#crmbtn:hover{border-color:var(--accent)}`;
    document.head.append(s);
  }
  function shell(){
    dlg = document.createElement('dialog'); dlg.id = 'crm'; dlg.setAttribute('aria-label', 'CRM');
    dlg.innerHTML = `<div class="q-ch"><h2>CRM <span class="q-pill">AI audio engineer</span></h2><button type="button" class="q-x" data-c="close" aria-label="Close">×</button></div><div class="q-ct" role="tablist"></div><div class="q-cb"></div>`;
    document.body.append(dlg);
    dlg.addEventListener('click', onClick); dlg.addEventListener('change', onChange); dlg.addEventListener('submit', e => e.preventDefault());
    dlg.addEventListener('close', () => { if (location.hash === '#crm') history.replaceState(null, '', location.pathname + location.search); });
  }
  function openCRM(v){ if (!dlg) shell(); if (v) view = v; render(); dlg.open || dlg.showModal(); load(); }
  window.openCRM = openCRM;

  function render(){
    if (!dlg) return;
    const m = model(), tabs = [['today', 'Today'], ['clients', 'Clients'], ['bookings', 'Bookings'], ['deliveries', 'Deliveries'], ['engineer', 'AI engineer']];
    dlg.querySelector('.q-ct').innerHTML = tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${view === k && !open1}" class="${view === k && !open1 ? 'q-on' : ''}" data-v="${k}">${l}</button>`).join('');
    const b = dlg.querySelector('.q-cb'), top = b.scrollTop;
    b.innerHTML = open1 ? clientPage(m, open1) : ({today: todayView, clients, bookings, deliveries, engineer})[view](m);
    b.scrollTop = top;
  }
  const av = n => `<span class="q-av" aria-hidden="true">${h((n || '?').trim()[0]?.toUpperCase() || '?')}</span>`;
  const cRow = c => `<button type="button" class="q-row q-btn" data-open="${h(c.id)}">${av(c.name)}<span class="q-grow"><b>${h(c.name)}</b><small>${h([...c.emails][0] || 'no email')} · ${c.songs.size} song${c.songs.size === 1 ? '' : 's'} · last ${h(day(c.last) || '—')}</small></span>${c.waiting ? '<span class="q-pill q-a">waiting on you</span>' : ''}${c.owed > 0.5 ? `<span class="q-pill q-r">owes ${money(c.owed)}</span>` : ''}${c.tasks.some(t => t.status !== 'done') ? `<span class="q-pill q-g">${c.tasks.filter(t => t.status !== 'done').length} task</span>` : ''}</button>`;
  function todayView(m){
    const t = isoToday(), wk = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), mo = t.slice(0, 7);
    const up = (doc.bookings || []).filter(b => b.date >= t && b.date <= wk && b.status !== 'cancelled').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const owed = m.list.reduce((s, c) => s + Math.max(0, c.owed), 0), monthRev = (doc.bookings || []).filter(b => b.date.startsWith(mo) && b.status !== 'cancelled' && b.status !== 'hold').reduce((s, b) => s + bookTotal(b), 0);
    const wait = m.list.filter(c => c.waiting), open = (doc.tasks || []).filter(x => x.status !== 'done');
    return `<div class="q-grid"><div class="q-stat"><b>${up.length}</b><span>sessions in the next 7 days</span></div><div class="q-stat"><b>${money(monthRev)}</b><span>booked this month</span></div><div class="q-stat"><b>${money(owed)}</b><span>still owed to you</span></div><div class="q-stat"><b>${wait.length}</b><span>clients waiting on you</span></div><div class="q-stat"><b>${open.length}</b><span>open engineer tasks</span></div></div>
      <div class="q-two"><div><h3>Coming up</h3>${up.length ? up.map(b => bRow(m, b)).join('') : '<div class="q-empty">No sessions this week. <button type="button" class="q-b q-s" data-c="newbook">Add a session</button></div>'}
      <h3>Waiting on you</h3>${wait.length ? wait.slice(0, 8).map(c => `<div class="q-row">${av(c.name)}<span class="q-grow"><b>${h(c.name)}</b><small>Sent you “${h(c.waiting.file)}” ${h(day(c.waiting.at))}</small></span><button type="button" class="q-b q-s" data-c="qcfile" data-k="${h(c.waiting.k)}" data-f="${h(c.waiting.file)}" data-cl="${h(c.id)}">Check it</button><button type="button" class="q-b q-s" data-open="${h(c.id)}">Open</button></div>`).join('') : '<div class="q-empty">Nobody’s waiting on a reply.</div>'}</div>
      <div><h3>Engineer tasks</h3>${open.length ? open.slice(0, 8).map(x => tRow(m, x)).join('') : '<div class="q-empty">No open tasks.</div>'}
      <h3>Recent deliveries</h3>${m.out.slice(0, 6).map(r => dRow(m, r)).join('') || '<div class="q-empty">Nothing sent yet.</div>'}</div></div>`;
  }
  function clients(m){
    const q = (clients.q || '').toLowerCase(), L = m.list.filter(c => !q || c.name.toLowerCase().includes(q) || [...c.emails].some(e => e.includes(q)));
    return `<div class="q-sb"><input type="search" placeholder="Search clients" value="${h(clients.q || '')}" data-q="clients" style="flex:1"><button type="button" class="q-b q-p" data-c="newclient">+ Client</button></div>
      ${L.map(cRow).join('') || '<div class="q-empty">No clients yet. They appear here from the files you send and receive, or add one.</div>'}`;
  }
  function bRow(m, b){
    const tot = bookTotal(b), due = tot - (+b.paid || 0);
    return `<button type="button" class="q-row q-btn" data-book="${h(b.id)}"><span class="q-av" aria-hidden="true">${h(new Date(b.date + 'T12:00').getDate() || '?')}</span><span class="q-grow"><b>${h(clientName(m, b.client))}${b.room ? ' · ' + h(b.room) : ''}</b><small>${h(day(b.date))}${b.start ? ' · ' + h(b.start) : ''}${b.hours ? ' · ' + h(b.hours) + ' h' : ''}${tot ? ' · ' + money(tot) : ''}</small></span><span class="q-pill${b.status === 'paid' ? ' q-g' : b.status === 'hold' ? ' q-a' : ''}">${STAT[b.status] || 'Booked'}</span>${due > 0.5 && b.status !== 'cancelled' && b.status !== 'hold' ? `<span class="q-pill q-r">${money(due)} due</span>` : ''}</button>`;
  }
  function bookings(m){
    const t = isoToday(), all = [...(doc.bookings || [])].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
    const up = all.filter(b => b.date >= t).reverse(), past = all.filter(b => b.date < t);
    return `<div class="q-sb"><button type="button" class="q-b q-p" data-c="newbook">+ Session</button><span class="q-pill">${money(all.filter(b => b.status !== 'cancelled' && b.status !== 'hold').reduce((s, b) => s + bookTotal(b), 0))} booked all time</span></div>${form?.type === 'book' ? bookForm(m) : ''}
      <h3>Upcoming</h3>${up.map(b => bRow(m, b)).join('') || '<div class="q-empty">Nothing booked.</div>'}<h3>Past</h3>${past.map(b => bRow(m, b)).join('') || '<div class="q-empty">No past sessions.</div>'}`;
  }
  function bookForm(m){
    const b = form.b, opts = m.list.map(c => `<option value="${h(c.id)}"${c.id === b.client ? ' selected' : ''}>${h(c.name)}</option>`).join('');
    return `<form class="q-f" data-form="book"><label>Client<select name="client"><option value="">Choose…</option>${opts}</select></label><label>Date<input type="date" name="date" value="${h(b.date)}" required></label><label>Start<input type="time" name="start" value="${h(b.start || '')}"></label><label>Hours<input type="number" name="hours" min="0" step="0.5" value="${h(b.hours ?? '')}"></label>
      <label>Rate / hour<input type="number" name="rate" min="0" step="1" value="${h(b.rate ?? '')}"></label><label>or flat price<input type="number" name="flat" min="0" step="1" value="${h(b.flat ?? '')}"></label><label>Paid so far<input type="number" name="paid" min="0" step="1" value="${h(b.paid ?? '')}"></label><label>Room / studio<input name="room" value="${h(b.room || '')}" placeholder="e.g. Vivid A"></label>
      <label>Status<select name="status">${Object.entries(STAT).map(([k, l]) => `<option value="${k}"${(b.status || 'booked') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="q-wide">Notes<textarea name="notes">${h(b.notes || '')}</textarea></label>
      <div class="q-wide q-sb"><button type="button" class="q-b q-p" data-c="savebook">Save</button><button type="button" class="q-b" data-c="cancelform">Cancel</button>${form.b.id ? `<button type="button" class="q-b" data-c="ics">Add to calendar (.ics)</button><button type="button" class="q-b" data-c="delbook" style="margin-left:auto">Delete</button>` : ''}</div></form>`;
  }
  function dRow(m, r){ const c = m.cl.get(m.byMail.get(r.email)); return `<div class="q-row"><span class="q-grow"><b>${h(r.file || r.song)}</b><small>to ${h(c?.name || r.email)} · ${h(day(r.at))}${r.app ? ' · from the app' : ''}</small></span><button type="button" class="q-b q-s" data-song="${h(r.k)}">Song</button></div>`; }
  function deliveries(m){
    const q = (deliveries.q || '').toLowerCase(), L = m.out.filter(r => !q || (r.file + r.song + r.email + (m.cl.get(m.byMail.get(r.email))?.name || '')).toLowerCase().includes(q));
    return `<div class="q-sb"><input type="search" placeholder="Search by client, song or file" value="${h(deliveries.q || '')}" data-q="deliveries" style="flex:1"><span class="q-pill">${m.out.length} sent · ${m.inn.length} received</span></div>${L.slice(0, 200).map(r => dRow(m, r)).join('') || '<div class="q-empty">Nothing found.</div>'}`;
  }
  function tRow(m, x){
    const st = x.status === 'done' ? '<span class="q-pill q-g">done</span>' : x.status === 'running' ? `<span class="q-pill q-a">${h(x.note || 'working…')}</span>` : '<span class="q-pill">to do</span>';
    const act = x.kind === 'qc' ? (x.status === 'running' ? '' : `<button type="button" class="q-b q-s" data-c="runqc" data-t="${h(x.id)}">${x.report ? 'Check again' : 'Run check'}</button>`) : `<button type="button" class="q-b q-s" data-song="${h(x.song || '')}" ${x.song ? '' : 'disabled'}>Open song</button>${x.status !== 'done' ? `<button type="button" class="q-b q-s" data-c="donetask" data-t="${h(x.id)}">Done</button>` : ''}`;
    const rep = x.report ? `<div class="q-rep"><div class="q-meters"><span class="q-pill">${r1(x.report.met.lufs)} LUFS</span><span class="q-pill">${r1(x.report.met.tp)} dBTP</span><span class="q-pill">range ${r1(x.report.met.lra)} LU</span><span class="q-pill">stereo ${x.report.met.corr.toFixed(2)}</span><span class="q-pill">${Math.floor(x.report.met.dur / 60)}:${String(Math.round(x.report.met.dur % 60)).padStart(2, '0')}</span></div><ul style="margin:0;padding:0">${x.report.find.map(f => `<li class="q-${f.lvl}">${h(f.t)}${f.d ? `<small>${h(f.d)}</small>` : ''}</li>`).join('')}</ul>${x.report.notes ? `<div class="q-notes">${h(x.report.notes)}</div>` : g('aiKeys')?.groq ? `<button type="button" class="q-b q-s" data-c="ainotes" data-t="${h(x.id)}" style="margin-top:8px">✦ Write engineer notes</button>` : ''}</div>` : '';
    return `<div class="q-row"><span class="q-grow"><b>${h(KINDS[x.kind] || x.kind)}${x.file ? ' · ' + h(x.file) : x.song ? ' · ' + h(m.songs.get(x.song)?.title || '') : ''}</b><small>${h(clientName(m, x.client))}${x.due ? ' · due ' + h(day(x.due)) : ''}${x.text ? ' · ' + h(x.text) : ''}</small></span>${st}${act}<button type="button" class="q-b q-s" data-c="deltask" data-t="${h(x.id)}" aria-label="Remove task">×</button></div>${rep}`;
  }
  function engineer(m){
    const open = (doc.tasks || []).filter(x => x.status !== 'done'), done = (doc.tasks || []).filter(x => x.status === 'done').slice(-30).reverse();
    return `<p class="q-empty" style="padding-top:0">Your AI audio engineer listens to a bounce and measures loudness (LUFS), true peak, clipping, stereo/phase, low end and tone, then tells you what to fix. Other jobs (stems, lyrics, tempo &amp; key, Studio edits, Mac bounces) open the song where those tools are.</p>
      <div class="q-sb"><button type="button" class="q-b q-p" data-c="newtask">+ Task</button><button type="button" class="q-b" data-c="newqc">Check a mix</button></div>${form?.type === 'task' ? taskForm(m) : ''}
      <h3>Open</h3>${open.map(x => tRow(m, x)).join('') || '<div class="q-empty">Nothing open.</div>'}<h3>Done</h3>${done.map(x => tRow(m, x)).join('') || '<div class="q-empty">Nothing yet.</div>'}`;
  }
  function songOpts(m, cid, sel){
    const c = m.cl.get(cid), ks = c ? [...c.songs] : [...m.songs.keys()];
    return ks.filter(k => m.songs.has(k)).sort((a, b) => m.songs.get(a).title.localeCompare(m.songs.get(b).title)).slice(0, 600).map(k => `<option value="${h(k)}"${k === sel ? ' selected' : ''}>${h(m.songs.get(k).title)}</option>`).join('');
  }
  function taskForm(m){
    const t = form.t, s = m.songs.get(t.song), files = s ? (s.versions || []).filter(v => /\.(mp3|wav|m4a|aiff?|flac)$/i.test(v.name)) : [];
    return `<form class="q-f" data-form="task"><label>Job<select name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}"${t.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Client<select name="client"><option value="">None</option>${m.list.map(c => `<option value="${h(c.id)}"${c.id === t.client ? ' selected' : ''}>${h(c.name)}</option>`).join('')}</select></label>
      <label>Song<select name="song"><option value="">Choose…</option>${songOpts(m, t.client, t.song)}</select></label>
      ${t.kind === 'qc' ? `<label>File<select name="file">${files.map(v => `<option${v.name === t.file ? ' selected' : ''}>${h(v.name)}</option>`).join('') || '<option value="">Pick a song first</option>'}</select></label><label>It’s a<select name="purpose"><option value="release master"${t.purpose === 'release master' ? ' selected' : ''}>Master for release</option><option value="mix for mastering"${t.purpose === 'mix for mastering' ? ' selected' : ''}>Mix for mastering</option><option value="rough / demo"${t.purpose === 'rough / demo' ? ' selected' : ''}>Rough / demo</option></select></label>` : `<label>Due<input type="date" name="due" value="${h(t.due || '')}"></label>`}
      <label class="q-wide">Notes<input name="text" value="${h(t.text || '')}" placeholder="e.g. tune the hook, 808 too loud"></label>
      <div class="q-wide q-sb"><button type="button" class="q-b q-p" data-c="savetask">${t.kind === 'qc' ? 'Check it now' : 'Add task'}</button><button type="button" class="q-b" data-c="cancelform">Cancel</button></div></form>`;
  }
  function clientPage(m, id){
    const c = m.cl.get(id); if (!c) { open1 = null; return clients(m); }
    const i = c.info || {}, others = m.list.filter(x => x.id !== id);
    return `<div class="q-sb"><button type="button" class="q-b" data-c="back">‹ Back</button><span style="flex:1"></span><button type="button" class="q-b" data-c="newbook" data-cl="${h(id)}">+ Session</button><button type="button" class="q-b" data-c="newtask" data-cl="${h(id)}">+ Task</button></div>
      <div class="q-f" data-form="client" data-id="${h(id)}"><label>Name<input name="name" value="${h(c.name)}"></label><label>Emails (comma separated)<input name="emails" value="${h([...c.emails].join(', '))}"></label><label>Phone<input name="phone" type="tel" value="${h(i.phone || '')}"></label><label>Instagram<input name="ig" value="${h(i.ig || '')}" placeholder="@handle"></label>
      <label>Usual rate / hour<input name="rate" type="number" min="0" value="${h(i.rate || '')}"></label><label>Usual studio<input name="room" value="${h(i.room || '')}"></label><label class="q-wide">Notes<textarea name="notes" placeholder="How they like their mixes, deal terms, reminders…">${h(i.notes || '')}</textarea></label>
      <div class="q-wide q-sb"><button type="button" class="q-b q-p" data-c="saveclient">Save</button>${others.length ? `<select data-merge="${h(id)}" aria-label="Merge into another client"><option value="">Same person as…</option>${others.map(x => `<option value="${h(x.id)}">${h(x.name)}</option>`).join('')}</select>` : ''}<button type="button" class="q-b" data-c="hideclient" data-cl="${h(id)}" style="margin-left:auto">${id.startsWith('m:') ? 'Delete' : 'Hide'}</button></div></div>
      <div class="q-grid"><div class="q-stat"><b>${c.songs.size}</b><span>songs</span></div><div class="q-stat"><b>${c.out.length}</b><span>files sent</span></div><div class="q-stat"><b>${c.inn.length}</b><span>files received</span></div><div class="q-stat"><b>${money(c.bookings.filter(b => b.status !== 'cancelled' && b.status !== 'hold').reduce((s, b) => s + bookTotal(b), 0))}</b><span>booked</span></div><div class="q-stat"><b>${money(Math.max(0, c.owed))}</b><span>owed</span></div></div>
      ${form?.type === 'book' ? bookForm(m) : ''}${form?.type === 'task' ? taskForm(m) : ''}
      <div class="q-two"><div><h3>Sessions</h3>${c.bookings.sort((a, b) => b.date.localeCompare(a.date)).map(b => bRow(m, b)).join('') || '<div class="q-empty">No sessions.</div>'}
      <h3>Engineer tasks</h3>${c.tasks.map(x => tRow(m, x)).join('') || '<div class="q-empty">No tasks.</div>'}</div>
      <div><h3>Received from them</h3>${c.inn.slice(0, 12).map(r => `<div class="q-row"><span class="q-grow"><b>${h(r.file)}</b><small>${h(day(r.at))}</small></span><button type="button" class="q-b q-s" data-c="qcfile" data-k="${h(r.k)}" data-f="${h(r.file)}" data-cl="${h(id)}">Check</button><button type="button" class="q-b q-s" data-song="${h(r.k)}">Song</button></div>`).join('') || '<div class="q-empty">Nothing yet.</div>'}
      <h3>Sent to them</h3>${c.out.slice(0, 12).map(r => dRow(m, r)).join('') || '<div class="q-empty">Nothing yet.</div>'}
      <h3>Songs</h3>${[...c.songs].filter(k => m.songs.has(k)).slice(0, 40).map(k => `<div class="q-row"><span class="q-grow"><b>${h(m.songs.get(k).title)}</b><small>${m.songs.get(k).versions.length} files</small></span><button type="button" class="q-b q-s" data-c="qcsong" data-k="${h(k)}" data-cl="${h(id)}">Check mix</button><button type="button" class="q-b q-s" data-song="${h(k)}">Open</button></div>`).join('') || '<div class="q-empty">No songs.</div>'}</div></div>`;
  }

  /* ---------- actions ---------- */
  const fd = sel => Object.fromEntries([...dlg.querySelectorAll(sel + ' [name]')].map(x => [x.name, x.value.trim()]));
  const task = id => (doc.tasks || []).find(x => x.id === id);
  function latestAudio(k){ const s = g('songs')?.get(k); const vs = (s?.versions || []).filter(v => /\.(mp3|wav|m4a|aiff?|flac)$/i.test(v.name)); return vs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]; }
  function startQC(t){ (doc.tasks ||= []).push(t); save(); view = view === 'today' || open1 ? view : 'engineer'; render(); runQC(t).catch(e => { t.status = 'todo'; t.note = ''; render(); toast('Couldn’t check it: ' + (e?.message || e?.code || 'error')); }); }
  function onClick(e){
    const el = e.target.closest('[data-v],[data-open],[data-book],[data-song],[data-c]'); if (!el) return;
    if (el.dataset.v) { view = el.dataset.v; open1 = null; form = null; return render(); }
    if (el.dataset.open) { open1 = el.dataset.open; form = null; dlg.querySelector('.q-cb').scrollTop = 0; return render(); }
    if (el.dataset.book) { const b = doc.bookings.find(x => x.id === el.dataset.book); form = {type: 'book', b: {...b}}; if (!open1) view = 'bookings'; render(); dlg.querySelector('[data-form=book]')?.scrollIntoView({block: 'nearest'}); return; }
    if (el.dataset.song !== undefined && el.dataset.c === undefined) { const k = el.dataset.song; if (!k) return; dlg.close(); setTimeout(() => g('jumpTo')?.(k), 60); return; }
    const c = el.dataset.c, m = () => model();
    if (c === 'close') return dlg.close();
    if (c === 'back') { open1 = null; form = null; return render(); }
    if (c === 'cancelform') { form = null; return render(); }
    if (c === 'newclient') { const id = 'm:' + uidv(); (doc.clients ||= {})[id] = {name: 'New client', emails: []}; save(); open1 = id; return render(); }
    if (c === 'saveclient') { const id = dlg.querySelector('[data-form=client]').dataset.id, v = fd('[data-form=client]'); doc.clients[id] = {...(doc.clients[id] || {}), ...v, emails: v.emails.split(/[,;\s]+/).map(norm).filter(isMail)}; save(); toast('Saved.'); return render(); }
    if (c === 'hideclient') { const id = el.dataset.cl; if (id.startsWith('m:')) { if (!confirm('Delete this client? Their sessions and tasks stay.')) return; delete doc.clients[id]; } else doc.clients[id] = {...(doc.clients[id] || {}), hidden: true}; save(); open1 = null; return render(); }
    if (c === 'newbook') { const cl = el.dataset.cl || open1 || '', i = doc.clients?.[cl] || {}; form = {type: 'book', b: {client: cl, date: isoToday(), hours: 2, rate: i.rate || '', room: i.room || '', status: 'booked'}}; if (!open1) view = 'bookings'; return render(); }
    if (c === 'savebook') { const v = fd('[data-form=book]'); if (!v.date) return toast('Pick a date.'); const b = {...form.b, ...v, hours: +v.hours || 0, rate: +v.rate || 0, flat: +v.flat || 0, paid: +v.paid || 0}; if (b.status === 'paid' && !b.paid) b.paid = bookTotal(b); if (!b.id) { b.id = uidv(); (doc.bookings ||= []).push(b); } else doc.bookings = doc.bookings.map(x => x.id === b.id ? b : x); save(); form = null; toast('Session saved.'); return render(); }
    if (c === 'delbook') { if (!confirm('Delete this session?')) return; doc.bookings = doc.bookings.filter(x => x.id !== form.b.id); form = null; save(); return render(); }
    if (c === 'ics') return ics(form.b, m());
    if (c === 'newtask' || c === 'newqc') { form = {type: 'task', t: {kind: c === 'newqc' ? 'qc' : 'mix', client: el.dataset.cl || open1 || '', song: '', purpose: 'release master'}}; if (!open1) view = 'engineer'; return render(); }
    if (c === 'savetask') { const v = fd('[data-form=task]'), t = {...form.t, ...v, id: uidv(), at: new Date().toISOString().slice(0, 16), status: 'todo'}; if (!t.song && t.kind !== 'other') return toast('Pick a song.'); form = null; if (t.kind === 'qc') { if (!t.file) { const lv = latestAudio(t.song); if (!lv) return toast('That song has no audio file.'); t.file = lv.name; } return startQC(t); } (doc.tasks ||= []).push(t); save(); return render(); }
    if (c === 'qcfile' || c === 'qcsong') { const k = el.dataset.k, f = el.dataset.f || latestAudio(k)?.name; if (!f) return toast('That song has no audio file.'); return startQC({id: uidv(), kind: 'qc', client: el.dataset.cl || '', song: k, file: f, purpose: 'release master', status: 'todo', at: new Date().toISOString().slice(0, 16)}); }
    if (c === 'runqc') { const t = task(el.dataset.t); return t && runQC(t).catch(err => { t.status = 'todo'; t.note = ''; render(); toast('Couldn’t check it: ' + (err?.message || err?.code || 'error')); }); }
    if (c === 'ainotes') { const t = task(el.dataset.t); return t && aiNotes(t); }
    if (c === 'donetask') { const t = task(el.dataset.t); if (t) { t.status = 'done'; save(); render(); } return; }
    if (c === 'deltask') { doc.tasks = doc.tasks.filter(x => x.id !== el.dataset.t); save(); return render(); }
  }
  function onChange(e){
    const el = e.target;
    if (el.dataset.q) { (el.dataset.q === 'clients' ? clients : deliveries).q = el.value; const p = el.selectionStart; render(); const n = dlg.querySelector(`[data-q="${el.dataset.q}"]`); n?.focus(); try { n.setSelectionRange(p, p); } catch (_) {} return; }
    if (el.dataset.merge) { const into = el.value; if (!into) return; doc.clients[el.dataset.merge] = {...(doc.clients[el.dataset.merge] || {}), into}; save(); open1 = into; toast('Merged.'); return render(); }
    const f = el.closest('[data-form=task]'); if (f && ['kind', 'client', 'song'].includes(el.name)) { Object.assign(form.t, fd('[data-form=task]')); if (el.name !== 'kind') form.t.file = ''; if (el.name === 'song') form.t.file = latestAudio(el.value)?.name || ''; render(); }
  }
  document.addEventListener('input', e => { if (e.target.dataset?.q && e.target.closest('#crm')) { clearTimeout(onChange.t); onChange.t = setTimeout(() => onChange(e), 250); } });
  function ics(b, m){
    const s = (b.date + 'T' + (b.start || '12:00')).replace(/[-:]/g, '') + '00', st = new Date(b.date + 'T' + (b.start || '12:00')), en = new Date(st.getTime() + (+b.hours || 1) * 36e5);
    const pad = n => String(n).padStart(2, '0'), e2 = `${en.getFullYear()}${pad(en.getMonth() + 1)}${pad(en.getDate())}T${pad(en.getHours())}${pad(en.getMinutes())}00`;
    const esc2 = x => String(x || '').replace(/[,;\\]/g, m2 => '\\' + m2).replace(/\n/g, '\\n');
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adil Majarali//Maj CRM//EN', 'BEGIN:VEVENT', `UID:${b.id}@majcrm`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART:${s}`, `DTEND:${e2}`, `SUMMARY:${esc2('Session: ' + clientName(m, b.client))}`, `LOCATION:${esc2(b.room)}`, `DESCRIPTION:${esc2(b.notes)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type: 'text/calendar'})); a.download = `session-${b.date}.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- hook into the app ---------- */
  function ready(){ try { return !!g('songs') && !!document.querySelector('header .status'); } catch (_) { return false; } }
  function mount(){
    if (window.MV_CONFIG?.product) return;
    css();
    const mt = document.getElementById('mtools'), bar = document.querySelector('header .status');
    const b = Object.assign(document.createElement('button'), {type: 'button', id: 'crmbtn', title: 'CRM: clients, bookings, deliveries and the AI engineer', textContent: 'CRM'});
    b.setAttribute('aria-label', 'Open CRM'); b.onclick = () => openCRM();
    mt ? mt.parentNode.insertBefore(b, mt) : bar.insertBefore(b, bar.firstChild);
    if (location.hash === '#crm') openCRM();
    window.addEventListener('hashchange', () => location.hash === '#crm' && openCRM());
    load();
  }
  const wait = setInterval(() => { if (ready()) { clearInterval(wait); mount(); } }, 400);
  window.__crmTest = {analyse, findings, model: () => model(), doc: () => doc};
})();
