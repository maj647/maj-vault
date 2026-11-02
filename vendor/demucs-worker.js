/* Splits a song into vocals, drums, bass and other on this device (Demucs, MIT, run with ONNX Runtime Web).
   The model (about 170 MB) downloads once and is kept in this browser's cache. Nothing is uploaded. */
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.webgpu.bundle.min.mjs';
import { DemucsProcessor, CONSTANTS } from './demucs/index.js';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
const MODEL = CONSTANTS.DEFAULT_MODEL_URL, CACHE = 'mv-demucs-v1';
let proc = null;

async function modelBytes(){
  const c = await caches.open(CACHE); let r = await c.match(MODEL);
  if (!r) {
    const net = await fetch(MODEL); if (!net.ok) throw new Error('the separation model could not be downloaded (' + net.status + ')');
    const total = +net.headers.get('content-length') || 172e6, rd = net.body.getReader(), parts = []; let got = 0;
    for (;;) { const {done, value} = await rd.read(); if (done) break; parts.push(value); got += value.length; postMessage({phase: 'download', p: got / total}); }
    const blob = new Blob(parts); await c.put(MODEL, new Response(blob, {headers: {'content-type': 'application/octet-stream'}})); return blob.arrayBuffer();
  }
  return r.arrayBuffer();
}
self.onmessage = async e => {
  try {
    if (!proc) {
      proc = new DemucsProcessor({ort, onProgress: p => postMessage({phase: 'split', p: p.progress ?? p}), sessionOptions: {executionProviders: ('gpu' in navigator) ? ['webgpu', 'wasm'] : ['wasm']}});
      postMessage({phase: 'load'}); await proc.loadModel(await modelBytes());
    }
    const {left, right} = e.data; postMessage({phase: 'split', p: 0});
    const out = await proc.separate(left, right);
    const res = {}; const xfer = [];
    for (const t of ['vocals', 'drums', 'bass', 'other']) { res[t] = {left: out[t].left, right: out[t].right}; xfer.push(out[t].left.buffer, out[t].right.buffer); }
    postMessage({phase: 'done', stems: res}, xfer);
  } catch (err) { postMessage({phase: 'error', message: String(err && err.message || err)}); }
};
