// Scroll-driven fly-over of a real lidar point cloud (USGS 3DEP, public domain).
// three.js r187 WebGPURenderer + TSL (falls back to its WebGL2 backend where WebGPU is missing).
// mount(canvas, { url, onReadout, tour, heroEnd }) -> { setProgress(p), dispose() }
// tour: progress covers the whole page; the hero orbit runs until heroEnd, then the camera keeps touring the massif
import * as THREE from '../three/three.webgpu.js';
import { attribute, uniform, float, vec3, mix, smoothstep, abs, positionLocal, positionView, clamp, max } from '../three/three.tsl.js';

export async function mount(canvas, opts) {
  const data = await new Promise((resolve, reject) => {
    const w = new Worker(new URL('./pc-worker.js', import.meta.url));
    w.onmessage = (e) => { w.terminate(); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data); };
    w.onerror = (e) => { w.terminate(); reject(e); };
    w.postMessage({ url: opts.url });
  });
  const b = data.bounds, H = b[5] - b[2];

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, opts.maxDpr || 1.5));
  await renderer.init();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(opts.fog || 0x0b1424, 700, 2900);   // hides the square edge of the tile
  const camera = new THREE.PerspectiveCamera(48, 1, 5, 9000);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  geo.setAttribute('inten', new THREE.BufferAttribute(data.inten, 1));
  geo.computeBoundingSphere();

  // colour: elevation ramp (deep blue valley -> pale ice ridges), lit by intensity; points behind the scan line are
  // "measured" (full brightness), ahead of it they stay dim; a thin red band marks the laser line itself.
  const uScan = uniform(-1e5), uBand = uniform(22.0);
  const h = clamp(positionLocal.y.div(H), 0, 1);
  const inten = attribute('inten', 'float');
  const low = vec3(0.05, 0.16, 0.32), high = vec3(0.78, 0.9, 1.0);
  const base = mix(low, high, smoothstep(0.0, 1.0, h)).mul(float(0.45).add(inten.mul(0.75)));
  const measured = smoothstep(uScan.add(1.0), uScan.sub(1.0), positionLocal.z);   // 1 behind the line
  const band = smoothstep(uBand, 0.0, abs(positionLocal.z.sub(uScan)));   // laser line
  const red = vec3(1.0, 0.27, 0.2);
  const depth = smoothstep(float(3200), float(900), positionView.z.negate());
  const glow = smoothstep(uBand.mul(10.0), 0.0, abs(positionLocal.z.sub(uScan)));   // soft halo around the laser line
  const lit = base.mul(2.05).add(vec3(0.05, 0.07, 0.11).mul(h));
  // the laser line replaces the terrain colour (a crisp red stroke, not a white-out), with a soft red halo around it
  const col = mix(mix(base.mul(0.95), lit.mul(1.12), measured).mul(float(0.62).add(depth.mul(0.85))).add(red.mul(glow.mul(0.32))), vec3(1.0, 0.16, 0.1).mul(1.9), band);
  const mat = new THREE.PointsNodeMaterial({ transparent: false, depthWrite: true });
  // round footprint: points fade out towards the tile edge, so the square cut never shows
  const rad = positionLocal.xz.length();
  const edge = smoothstep(float(Math.min(b[3] - b[0], b[4] - b[1]) * 0.5), float(Math.min(b[3] - b[0], b[4] - b[1]) * 0.42), rad);
  mat.colorNode = max(col.mul(edge), vec3(0.0));
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  // camera: a slow descending orbit around the massif (local metres; x east, y up, z south)
  const ease = (v) => v * v * (3 - 2 * v);
  function pose(t, outPos, outLook) {
    const e = ease(t), ang = THREE.MathUtils.degToRad(-118 + 74 * e);
    const r = 1900 - 330 * e, y = 900 + 260 * Math.sin(Math.PI * Math.min(1, e * 1.1)) + 160 * e;
    outPos.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
    outLook.set(40 * e, 470 - 140 * e, 120 * e);
  }
  // after the hero: keyframed tour (skim low over the ridge, swing round, top-down map view, pull back wide)
  const K = [[0, -44, 1570, 1060, 40, 330, 120], [0.28, 25, 980, 600, 0, 400, 0], [0.52, 100, 1300, 860, -80, 430, -60],
             [0.78, 178, 520, 2250, 0, 320, 0], [1, 252, 2150, 1300, 0, 380, 0]];
  function tourPose(u, outPos, outLook) {
    let i = 0; while (i < K.length - 2 && u > K[i + 1][0]) i++;
    const A = K[i], B = K[i + 1], f = ease(Math.min(1, Math.max(0, (u - A[0]) / (B[0] - A[0]))));
    const L = (j) => A[j] + (B[j] - A[j]) * f, ang = THREE.MathUtils.degToRad(L(1)), r = L(2);
    outPos.set(Math.cos(ang) * r, L(3), Math.sin(ang) * r); outLook.set(L(4), L(5), L(6));
  }
  const heroEnd = opts.tour ? Math.min(0.9, Math.max(0.05, opts.heroEnd || 0.2)) : 1;
  const tmp = new THREE.Vector3(), target = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  function groundAt(x, z) {
    const G = data.G, gx = Math.min(G - 1, Math.max(0, ((x - b[0]) / (b[3] - b[0]) * G) | 0));
    const gy = Math.min(G - 1, Math.max(0, ((-z - b[1]) / (b[4] - b[1]) * G) | 0));
    return data.grid[gy * G + gx];
  }

  function size() {
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.fov = w < hh ? 66 : 42; camera.filmOffset = w < hh ? 1.5 : (opts.offset != null ? opts.offset : -6); camera.updateProjectionMatrix(); dirty = true;
  }
  let p = 0, dirty = true, visible = true;
  const now = () => (window.__pcNow ? window.__pcNow() : performance.now());
  let t0 = null;
  const easeOut = (v) => 1 - Math.pow(1 - v, 3);
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
  size(); addEventListener('resize', size);

  function frame() {
    if (dirty || visible) {
      dirty = false;
      if (t0 === null) t0 = now();
      const t = Math.min(1, Math.max(0, p)), s = (now() - t0) / 1000;
      const th = Math.min(1, t / heroEnd), tu = t > heroEnd ? (t - heroEnd) / (1 - heroEnd) : 0;
      if (tu > 0) tourPose(tu, camera.position, target); else pose(th, camera.position, target);
      // opening (first 3.2 s): frame 0 is a full-screen close pass over the lit ridge, then the camera pulls back
      // and swings round to the hero framing (a reveal, never a slow fade-in from the dark)
      const k = easeOut(Math.min(1, s / 3.2));
      camera.position.multiplyScalar(1 - 0.42 * (1 - k));
      camera.position.applyAxisAngle(UP, THREE.MathUtils.degToRad(-14 * (1 - k) + 6 * Math.sin(s * 0.22)));
      camera.position.y += 18 * Math.sin(s * 0.5);
      camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 320);   // never inside the slope
      camera.lookAt(target);
      // scan line sweeps from the north edge (z = -maxy) to the south edge over the first 82% of the scroll
      // scan line: rests over the north 55% of the tile at the top of the page and finishes the sweep with the scroll;
      // in the first 3.2 s after the cloud appears it sweeps in from the north edge, lighting the massif as it passes
      // tour: the line keeps sweeping back and forth across the tile as the page scrolls
      const span = b[4] - b[1];
      const rest = tu > 0 ? -b[4] + span * (0.5 - 0.42 * Math.cos(Math.PI * (1 + tu * 6))) + 50 * Math.sin(s * 1.3)
                          : -b[4] + span * (0.55 + 0.45 * Math.min(1, th / 0.85)) + 70 * Math.sin(s * 1.3);
      // opening: the line is already on the massif at frame 0 and races across it in 1.6 s
      const ks = easeOut(Math.min(1, s / 1.6));
      uScan.value = rest + (-b[4] + span * 0.36 - rest) * (1 - ks);
      renderer.render(scene, camera);
      if (opts.onReadout) {
        tmp.set(camera.position.x * 0.4, 0, uScan.value); tmp.y = groundAt(tmp.x, tmp.z);
        opts.onReadout(camera.position.distanceTo(tmp), t);
      }
    }
    raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);
  return {
    backend: renderer.backend && renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2',
    points: data.n,
    setProgress(v) { if (v !== p) { p = v; dirty = true; } },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', size); renderer.dispose(); geo.dispose(); }
  };
}
