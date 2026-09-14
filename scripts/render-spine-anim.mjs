// Renders each embedded Spine model into a no-JS animated WebP so a third
// party can embed the character with a bare <img> tag (no <script>, no WebGL)
// — the same context as the static SVG counter. The WebP plays on its own.
//
// Pipeline per model (assets/spine/<name>/):
//   1. serve the model files from a local HTTP server (the Spine runtime loads
//      them via XHR, which requires a real origin);
//   2. drive headless Chrome over CDP to load web/public/spine-player.html,
//      play a chosen animation, and capture N frames over one loop;
//   3. encode the frames into a looping animated WebP with ffmpeg, written to
//      assets/spine/<name>/anim/<motion>.webp (served by /spine/anim/).
//
// Usage:
//   node scripts/render-spine-anim.mjs                # render every model
//   node scripts/render-spine-anim.mjs <name> [...]   # render specific models
//
// Requires: a Chromium/Chrome on PATH (or CHROME env), and ffmpeg on PATH.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPINE_DIR = join(repoRoot, 'assets', 'spine');
const SPINE_JS = join(repoRoot, 'web', 'public', 'spine', 'spine-3.8.js');
const PLAYER = join(repoRoot, 'web', 'public', 'spine-player.html');

const FRAMES = Number(process.env.FRAMES || 30);       // frames per loop
const FPS = Number(process.env.FPS || 12);              // output fps (loop ~FRAMES/FPS s)
const QV = Number(process.env.QV || 80);                // webp quality
const MAXW = Number(process.env.MAXW || 720);           // output width
const PORT = Number(process.env.PORT || 8901);      // chrome devtools port
const HTTP_PORT = Number(process.env.HTTP_PORT || (PORT + 1)); // static server port
const CHROME = process.env.CHROME
  || (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'chrome');

// A self-contained capture page: loads the Spine runtime, plays a model, and
// exposes window.__ready (1 ready, -1 error, undefined still loading) plus
// window.__err. Uses the correct 3.8 webgl API (spine.webgl.SceneRenderer).
function capturePage(model, isJson, width, height) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#000">
<canvas id="c" width="${width}" height="${height}"></canvas>
<script>
window.__err='';
window.addEventListener('error', function(e){ window.__err = (window.__err||'') + ' | ' + (e.message||'error') + ' @' + (e.filename||'').split('/').pop() + ':' + (e.lineno||0); });
window.addEventListener('unhandledrejection', function(e){ window.__err = (window.__err||'') + ' | rej:' + (e.reason&&e.reason.message||e.reason); });
</script>
<script src="/spine-3.8.js"></script>
<script>
(function(){
  var MODEL=${JSON.stringify(model)}, IS_JSON=${isJson};
  var canvas=document.getElementById('c');
  var gl=canvas.getContext('webgl', {preserveDrawingBuffer: true})||canvas.getContext('experimental-webgl', {preserveDrawingBuffer: true});
  var dir='/m/'+MODEL+'/';
  var am=new spine.webgl.AssetManager(gl);
  var pending=2; // atlas + skeleton
  function done(){
    if(pending>0) return;
    if(am.hasErrors()){ window.__err=(window.__err||'')+' | '+JSON.stringify(am.getErrors()); window.__ready=-1; return; }
    init();
  }
  am.loadTextureAtlas(dir+'dyn.atlas',
    function(){ pending--; done(); },
    function(p,e){ window.__err=(window.__err||'')+' atlas:'+p; pending--; done(); });
  am.loadBinary(dir+(IS_JSON?'dyn.json':'dyn.skel'),
    function(){ pending--; done(); },
    function(p,e){ window.__err=(window.__err||'')+' skel:'+p; pending--; done(); });
  function init(){
    try {
      var atlas=am.get(dir+'dyn.atlas');
      var loader=new spine.AtlasAttachmentLoader(atlas);
      var sd=IS_JSON?new spine.SkeletonJson(loader).readSkeletonData(am.get(dir+'dyn.json'))
                    :new spine.SkeletonBinary(loader).readSkeletonData(am.get(dir+(IS_JSON?'dyn.json':'dyn.skel')));
      var skeleton=new spine.Skeleton(sd); skeleton.setToSetupPose();
      var state=new spine.AnimationState(new spine.AnimationStateData(sd));
      var renderer=new spine.webgl.SceneRenderer(canvas, gl, false);
      // pick the longest animation for a more complete loop
      var pick=sd.animations[0];
      sd.animations.forEach(function(a){ if(a.duration>pick.duration) pick=a; });
      state.setAnimation(0, pick.name, false);
      // fit: camera is centered on its position, zoom 1 => 1px == 1 unit.
      // SkeletonBounds only measures hit-box attachments, so use
      // skeleton.getBounds() which measures all region/mesh/path attachments.
      skeleton.updateWorldTransform();
      var off=new spine.Vector2(), sz=new spine.Vector2();
      skeleton.getBounds(off, sz);
      if (!isFinite(off.x) || sz.x <= 0 || sz.y <= 0) { off.x=-300; off.y=-450; sz.x=600; sz.y=900; }
      var spanX=sz.x||1, spanY=sz.y||1;
      var m=0.85;
      renderer.camera.zoom=Math.min(canvas.width*m/spanX, canvas.height*m/spanY);
      renderer.camera.position.x=off.x+sz.x/2;
      renderer.camera.position.y=off.y+sz.y/2;
      // Draw on demand: the CDP capture loop calls window.__draw(t) each frame.
      // This avoids relying on requestAnimationFrame, which is throttled in
      // headless Chrome. t is the animation time in seconds (wraps by duration).
      function drawAt(t){
        var tt = (t % pick.duration + pick.duration) % pick.duration;
        // seek the single track to time tt
        var te = state.tracks[0];
        if (te) { te.trackLast = tt; te.nextTrackLast = tt; te.animationLast = tt; te.nextAnimationLast = tt; te.animationStart = 0; te.delay = 0; }
        state.update(0);
        state.apply(skeleton);
        skeleton.updateWorldTransform();
        renderer.begin(); renderer.drawSkeleton(skeleton); renderer.end();
      }
      window.__draw = drawAt;
      window.__dur = pick.duration;
      drawAt(0); // synchronous first draw so the canvas isn't blank
      window.__ready=1;
    } catch(e){ window.__err=(window.__err||'')+' | init:'+e.message; window.__ready=-1; }
  }
})();
</script></body></html>`;
}

// Capture FRAMES by screenshotting just the canvas element at even intervals
// while the animation plays on its own (the capture page runs a continuous loop).
async function captureFrames(ws) {
  const out = [];
  // Resolve the canvas node so we can clip the screenshot to its box.
  const doc = await cdp(ws, 'DOM.getDocument');
  const q = await cdp(ws, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#c' });
  const model = await cdp(ws, 'DOM.getBoxModel', { nodeId: q.nodeId });
  const box = model.model.border; // [x1,y1, x2,y2, x3,y3, x4,y4]
  const clip = {
    x: box[0], y: box[1],
    width: box[2] - box[0], height: box[4] - box[1],
    scale: 1,
  };
  for (let i = 0; i < FRAMES; i++) {
    // advance the animation one step and draw, then screenshot
    const t = (i / FRAMES) * (await cdp(ws, 'Runtime.evaluate', { expression: 'window.__dur', returnByValue: true })).result.value;
    await cdp(ws, 'Runtime.evaluate', { expression: `window.__draw(${t})` });
    const r = await cdp(ws, 'Page.captureScreenshot', { format: 'png', clip });
    const buf = Buffer.from(r.data, 'base64');
    if (i === 0 && buf.length < 1024) {
      throw new Error('canvas screenshot too small (' + buf.length + ' bytes) — likely not rendered');
    }
    out.push(buf);
    if (i < FRAMES - 1) await sleep(50);
  }
  return out;
}

// Minimal CDP-over-WebSocket client (no external deps).
function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = cdp._id = (cdp._id || 0) + 1;
    const onMsg = (ev) => {
      let m;
      try { m = JSON.parse(ev.data instanceof ArrayBuffer ? Buffer.from(ev.data).toString('utf8') : ev.data); }
      catch { return; } // ignore non-JSON frames (keepalive, ping, etc.)
      if (m.id === id) { ws.removeEventListener('message', onMsg); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
    const timer = setTimeout(() => { ws.removeEventListener('message', onMsg); reject(new Error('cdp timeout ' + method)); }, 15000);
    const onErr = () => { clearTimeout(timer); ws.removeEventListener('message', onMsg); reject(new Error('ws error ' + method)); };
    ws.addEventListener('error', onErr, { once: true });
    setTimeout(() => clearTimeout(timer), 16000);
  });
}

async function openChrome() {
  const prof = join(repoRoot, 'node_modules', '.spine-prof-' + Date.now());
  mkdirSync(prof, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
    `--user-data-dir=${prof}`, '--no-sandbox', '--disable-gpu',
    `--window-size=${MAXW},900`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErr = '';
  chrome.on('error', (e) => { chromeErr += e.message + '\n'; });
  chrome.stderr.on('data', (d) => { chromeErr += d.toString(); });
  // Chrome's devtools may bind to 127.0.0.1 or [::1]; try both.
  const endpoints = [`http://127.0.0.1:${PORT}`, `http://[::1]:${PORT}`];
  // wait for devtools endpoint
  for (let i = 0; i < 50; i++) {
    for (const base of endpoints) {
      try {
        const tabs = await (await fetch(base + '/json')).json();
        const page = tabs.find(t => t.type === 'page');
        if (page) return { chrome, page, prof, devBase: base };
      } catch {}
    }
    await sleep(300);
  }
  console.error('chrome spawn error:\n' + chromeErr.slice(-800));
  throw new Error('chrome devtools not reachable');
}

async function connectWs(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error('ws connect: ' + (e.message || 'error'))); });
  ws.onerror = null;
  await cdp(ws, 'Runtime.enable');
  await cdp(ws, 'Page.enable');
  return ws;
}

function listModels() {
  if (!existsSync(SPINE_DIR)) return [];
  return readdirSync(SPINE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && (existsSync(join(SPINE_DIR, d.name, 'dyn.skel')) || existsSync(join(SPINE_DIR, d.name, 'dyn.json'))))
    .map(d => d.name)
    .sort();
}

function runFFmpeg(frames, outPath) {
  const tmp = join(dirname(outPath), '_frames');
  mkdirSync(tmp, { recursive: true });
  frames.forEach((f, i) => writeFileSync(join(tmp, `f_${String(i).padStart(4, '0')}.png`), f));
  const r = spawnSync('ffmpeg', [
    '-y', '-framerate', String(FPS), '-i', join(tmp, 'f_%04d.png'),
    '-c:v', 'libwebp', '-quality', String(QV), '-lossless', '0', outPath,
  ], { stdio: 'ignore' });
  // cleanup
  if (!process.env.KEEP_FRAMES) {
    try { readdirSync(tmp).forEach(f => { try { unlinkSync(join(tmp, f)); } catch {} }); } catch {}
  }
  return r.status === 0;
}

// Reuse the single default tab (Chrome 136+ removed the /json/new HTTP
// endpoint) by connecting to it, navigating to the model, and returning the socket.
async function renderModel(name, chrome) {
  const modelDir = join(SPINE_DIR, name);
  const isJson = existsSync(join(modelDir, 'dyn.json'));
  const ws = await connectWs(chrome.page.webSocketDebuggerUrl);
  // wait for the initial navigation to finish loading
  const loadP = new Promise((res) => {
    const onMsg = (ev) => {
      let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); } catch { return; }
      if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); res(); }
    };
    ws.addEventListener('message', onMsg);
    setTimeout(res, 10000);
  });
  await cdp(ws, 'Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/capture/${name}` });
  await loadP;
  let ready = false;
  for (let i = 0; i < 80; i++) {
    const r = await cdp(ws, 'Runtime.evaluate', { expression: 'window.__ready?1:0', returnByValue: true });
    if (r.result.value === 1) { ready = true; break; }
    if (r.result.value === -1) {
      const e = await cdp(ws, 'Runtime.evaluate', { expression: 'window.__err||""', returnByValue: true });
      console.log(`  ${name}: LOAD ERROR (${e.result.value})`);
      break;
    }
    await sleep(300);
  }
  if (!ready) {
    const diag = await cdp(ws, 'Runtime.evaluate', {
      expression: 'JSON.stringify({ready:window.__ready, err:window.__err})',
      returnByValue: true,
    }).catch(() => ({ result: { value: 'diag-failed' } }));
    console.log(`  ${name}: NOT READY ${diag.result.value}`);
    await closeTab(chrome.devBase, ws); return;
  }
  await sleep(400); // let the first frames settle
  const frames = await captureFrames(ws);
  await closeTab(chrome.devBase, ws);
  const animDir = join(modelDir, 'anim');
  mkdirSync(animDir, { recursive: true });
  const out = join(animDir, 'loop.webp');
  const ok = runFFmpeg(frames, out);
  const size = existsSync(out) ? readFileSync(out).length : 0;
  console.log(`  ${name}: ${ok ? 'OK' : 'FAIL'} anim/loop.webp (${(size / 1024).toFixed(0)}KB)`);
}

// Close a CDP tab by its target id (looked up via /json), then close the socket.
async function closeTab(devBase, ws) {
  try {
    const tabs = await (await fetch(devBase + '/json')).json();
    const t = tabs.find(x => x.webSocketDebuggerUrl === ws.url);
    if (t) await fetch(devBase + '/json/close/' + t.id);
  } catch {}
  try { ws.close(); } catch {}
}

async function main() {
  const wanted = process.argv.slice(2);
  const models = wanted.length ? wanted : listModels();
  if (!models.length) { console.log('no spine models found under assets/spine/'); return; }
  console.log('rendering models:', models.join(', '));

  // local static server for the model + capture assets
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${HTTP_PORT}`);
    const p = url.pathname;
    const send = (buf, ct) => { res.writeHead(200, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' }); res.end(buf); };
    if (p === '/spine-3.8.js') return send(readFileSync(SPINE_JS), 'application/javascript');
    if (p.startsWith('/m/')) {
      const f = p.slice(3).split('/').map(decodeURIComponent).join('/');
      const fp = join(SPINE_DIR, f);
      if (existsSync(fp)) return send(readFileSync(fp),
        f.endsWith('.png') ? 'image/png' : f.endsWith('.atlas') ? 'text/plain' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream');
      return res.writeHead(404).end('nf');
    }
    if (p.startsWith('/capture/')) {
      const name = p.split('/')[2];
      const isJson = existsSync(join(SPINE_DIR, name, 'dyn.json'));
      return send(Buffer.from(capturePage(name, isJson, MAXW, 900)), 'text/html; charset=utf-8');
    }
    res.writeHead(404).end('nf');
  });
  await new Promise(r => server.listen(HTTP_PORT, '127.0.0.1', r));

  const chrome = await openChrome();
  try {
    for (const name of models) {
      try { await renderModel(name, chrome); }
      catch (e) { console.log(`  ${name}: ERROR ${e.message}`); }
    }
  } finally {
    try { chrome.chrome.kill(); } catch {}
    server.close();
  }
  console.log('done');
}

process.on('unhandledRejection', (e) => { console.error('unhandled:', e); });

main().catch(e => { console.error(e); process.exit(1); });
