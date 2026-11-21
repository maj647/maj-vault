/* Maj Vault / Maj Clients: "Show in Finder" only for files that are really on this Mac or a plugged-in drive.
   Copyright (c) 2026 Adil Majarali. All rights reserved.
   Asks the Maj Vault helper on this Mac (127.0.0.1 only) where each file you're looking at lives. */
(() => {
  'use strict';
  const g = n => { try { return (0, eval)(n); } catch (_) { return undefined; } };
  const live = new Map();          // version key -> {path, on} | null (not on this Mac)
  let supported = true, busy = false, timer = 0, lastFull = 0;
  const keyOf = v => v.id || (v.gmail + '|' + v.name);
  const candidate = v => {
    if (v.src === 'L' && v.path) return v.path;
    const man = g('manifest'); const m = v.src === 'V' && man?.get?.(v.vfile);
    if (m?.src) return m.src;
    if (v.src === 'S') return v.path || v.session || '';
    return '';
  };
  window.mvLive = v => supported && v ? live.get(keyOf(v)) : undefined;

  function visibleVersions(){
    const keys = new Set([...document.querySelectorAll('.ver[data-key]')].map(e => e.dataset.key)); if (!keys.size) return [];
    const out = []; for (const [, s] of g('songs') || []) for (const v of s.versions || []) if (keys.has(keyOf(v))) out.push(v);
    return out;
  }
  async function check(force){
    if (busy || !supported || !g('finderOK') || !g('mcp')) return;
    const vs = visibleVersions().filter(v => force || !live.has(keyOf(v))); if (!vs.length) return;
    busy = true;
    try {
      const items = vs.slice(0, 150).map(v => ({k: keyOf(v), path: candidate(v), name: v.name}));
      const r = await g('mcp').callTool(g('FINDER'), 'where', {items}, {cache: false});
      const found = (r.payload || r).found || {};
      let changed = false;
      for (const it of items) { const nv = found[it.k] || null, ov = live.get(it.k); if (JSON.stringify(nv) !== JSON.stringify(ov ?? undefined)) changed = true; live.set(it.k, nv); }
      if (changed) g('draw')?.();
    } catch (e) {
      // an older helper (no "where" yet) or the helper isn't running: keep the old buttons
      if (/unknown action/i.test(e?.message || '') || e?.code === 'server_not_connected' || e?.code === 'tool_error') supported = false;
    } finally { busy = false; }
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(() => check(false), 350); };
  new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.('.ver') || n.querySelector?.('.ver'))) return soon(); }).observe(document.documentElement, {childList: true, subtree: true});
  // drives get plugged in and out: look again when you come back to the app
  const again = () => { if (document.visibilityState !== 'visible' || Date.now() - lastFull < 15000) return; lastFull = Date.now(); supported = true; check(true); };
  document.addEventListener('visibilitychange', again); window.addEventListener('focus', again);
})();
