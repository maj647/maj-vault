/*
 * Maj Vault service worker.
 * Copyright (c) 2026 Adil Majarali. All rights reserved.
 *
 * - Streams Drive audio of any size with seeking (passes Range through, adds your sign-in).
 * - Keeps the app shell so it opens instantly, even offline.
 */
const SHELL = 'mv-shell-cfe86af3818';
const FILES = ['./', 'index.html', 'platform.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'vault.bin'];
let token = null, exp = 0;

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('mv-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data?.type === 'token') { token = e.data.token; exp = e.data.exp || 0; } });

async function getToken(){
  if (token && Date.now() < exp) return token;
  const cs = await self.clients.matchAll({type: 'window'});
  for (const c of cs) {
    const t = await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = ev => res(ev.data?.token || null); c.postMessage({type: 'need-token'}, [ch.port2]); setTimeout(() => res(null), 4000); });
    if (t) { token = t; exp = Date.now() + 50 * 60e3; return t; }
  }
  return null;
}

async function stream(req, id, dl){
  const t = await getToken();
  if (!t) return new Response('Sign in again', {status: 401});
  const h = {Authorization: 'Bearer ' + t};
  const range = req.headers.get('range'); if (range) h.Range = range;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {headers: h});
  if (!dl) return r;
  const out = new Headers(r.headers);
  out.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(dl)}`);
  return new Response(r.body, {status: r.status, headers: out});
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    if (e.request.method === 'POST' && /\/share$/.test(u.pathname)) { e.respondWith((async () => {
      const fd = await e.request.formData(); const c = await caches.open('mv-share');
      for (const f of fd.getAll('audio')) if (f && f.size) await c.put(`share/${Date.now()}-${Math.random()}`, new Response(f, {headers: {'content-type': f.type || 'audio/mpeg', 'x-name': encodeURIComponent(f.name || 'shared.m4a')}}));
      return Response.redirect('./?shared=1', 303); })()); return; }
    const m = u.pathname.match(/\/stream\/drive\/([^/]+)$/);
    if (m) { e.respondWith(stream(e.request, m[1], u.searchParams.get('dl'))); return; }
    if (e.request.method === 'GET') {
      // app shell: network first so updates land, cache when offline
      e.respondWith(fetch(e.request, {cache: 'no-cache'}).then(r => { if (r.ok) { const c = r.clone(); caches.open(SHELL).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
    }
  }
});
