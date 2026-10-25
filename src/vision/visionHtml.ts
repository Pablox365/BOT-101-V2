/**
 * Page loaded in a WebView that opens the rear camera, runs the COCO-SSD
 * object detector with TensorFlow.js and posts what it sees back to React
 * Native. Running it in a WebView keeps the app working inside Expo Go,
 * with no native ML module needed.
 *
 * Messages posted to React Native (JSON):
 *   { type: 'status', status: 'loading' | 'ready' | 'error', message?: string }
 *   { type: 'detections', items: Detection[], fps: number }
 */
export const VISION_HTML = String.raw`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
</style>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"></script>
</head>
<body>
<video id="video" autoplay playsinline muted></video>
<canvas id="overlay"></canvas>
<script>
(function () {
  // Horizontal field of view of the iPhone main camera in landscape video.
  var HFOV_DEG = 63;
  // Typical real-world sizes in metres: [height, width].
  var SIZES = {
    person: [1.7, 0.5], bicycle: [1.1, 0.6], car: [1.5, 1.8], motorcycle: [1.3, 0.8],
    bus: [3.1, 2.5], truck: [3.2, 2.5], dog: [0.6, 0.3]
  };
  var MIN_SCORE = 0.45;

  function post(msg) {
    var json = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(json);
    else window.__voltaMessages = (window.__voltaMessages || []).concat([msg]);
  }

  var video = document.getElementById('video');
  var canvas = document.getElementById('overlay');
  var ctx = canvas.getContext('2d');
  var model = null;
  var running = true;
  var lastFrame = performance.now();
  var fps = 0;

  window.__voltaSetRunning = function (on) {
    running = !!on;
    if (running) loop();
  };

  function toDetection(p, w, h) {
    var size = SIZES[p.class];
    if (!size) return null;
    var bx = p.bbox[0], by = p.bbox[1], bw = p.bbox[2], bh = p.bbox[3];
    var f = (w / 2) / Math.tan((HFOV_DEG * Math.PI / 180) / 2);
    var cutVertically = by <= 2 || by + bh >= h - 2;
    var z = cutVertically ? size[1] * f / Math.max(bw, 1) : size[0] * f / Math.max(bh, 1);
    var cx = bx + bw / 2;
    var x = z * (cx - w / 2) / f;
    return { kind: p.class, x: +x.toFixed(2), z: +z.toFixed(2), score: +p.score.toFixed(2) };
  }

  function draw(preds) {
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    ctx.clearRect(0, 0, cw, ch);
    var vw = video.videoWidth, vh = video.videoHeight;
    // Same mapping as object-fit: cover.
    var s = Math.max(cw / vw, ch / vh);
    var ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2;
    ctx.lineWidth = 2;
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    preds.forEach(function (p) {
      if (!SIZES[p.class]) return;
      var x = ox + p.bbox[0] * s, y = oy + p.bbox[1] * s, w = p.bbox[2] * s, h = p.bbox[3] * s;
      ctx.strokeStyle = p.class === 'person' ? '#3e6ae1' : '#e0e0e0';
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(p.class, x + 3, y + 12);
    });
  }

  function loop() {
    if (!running || !model || video.readyState < 2) return;
    model.detect(video, 12, MIN_SCORE).then(function (preds) {
      var w = video.videoWidth, h = video.videoHeight;
      var items = [];
      preds.forEach(function (p) { var d = toDetection(p, w, h); if (d) items.push(d); });
      var now = performance.now();
      fps = fps * 0.8 + (1000 / Math.max(now - lastFrame, 1)) * 0.2;
      lastFrame = now;
      post({ type: 'detections', items: items, fps: Math.round(fps) });
      draw(preds);
      if (running) requestAnimationFrame(loop);
    }).catch(function (e) {
      post({ type: 'status', status: 'error', message: String(e && e.message || e) });
    });
  }

  async function start() {
    post({ type: 'status', status: 'loading' });
    try {
      if (!window.tf || !window.cocoSsd) throw new Error('No se pudo descargar el modelo (¿sin internet?)');
      var stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 360 } }
      });
      video.srcObject = stream;
      await video.play();
      await tf.setBackend('webgl').catch(function () {});
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      post({ type: 'status', status: 'ready' });
      loop();
    } catch (e) {
      post({ type: 'status', status: 'error', message: String(e && e.message || e) });
    }
  }

  start();
})();
</script>
</body>
</html>`;
