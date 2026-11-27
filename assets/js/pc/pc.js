// Scroll-driven fly-over of a real lidar point cloud (USGS 3DEP, public domain).
// three.js r187 WebGPURenderer + TSL (falls back to its WebGL2 backend where WebGPU is missing).
// mount(canvas, { url, onReadout }) -> { setProgress(p), dispose() }
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
  const uScan = uniform(-1e5), uBand = uniform(16.0);
  const h = clamp(positionLocal.y.div(H), 0, 1);
  const inten = attribute('inten', 'float');
  const low = vec3(0.05, 0.16, 0.32), high = vec3(0.78, 0.9, 1.0);
  const base = mix(low, high, smoothstep(0.0, 1.0, h)).mul(float(0.45).add(inten.mul(0.75)));
  const measured = smoothstep(uScan.add(1.0), uScan.sub(1.0), positionLocal.z);   // 1 behind the line
  const band = smoothstep(uBand, 0.0, abs(positionLocal.z.sub(uScan)));
  const red = vec3(1.0, 0.27, 0.2);
  const depth = smoothstep(float(3200), float(900), positionView.z.negate());
  const glow = smoothstep(uBand.mul(10.0), 0.0, abs(positionLocal.z.sub(uScan)));   // soft halo around the laser line
  const lit = base.mul(2.05).add(vec3(0.05, 0.07, 0.11).mul(h));
  const col = mix(base.mul(0.22), lit, measured).mul(float(0.42).add(depth.mul(0.95))).add(red.mul(band.mul(3.0))).add(red.mul(glow.mul(0.42)));
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
      pose(t, camera.position, target);
      // intro (first 2.8 s after the cloud appears): the camera glides in from further out
      const k = ease(Math.min(1, s / 5));
      camera.position.multiplyScalar(1 + 0.75 * (1 - k));
      camera.position.applyAxisAngle(UP, THREE.MathUtils.degToRad(-26 * (1 - k) + 6 * Math.sin(s * 0.22)));
      camera.position.y += 18 * Math.sin(s * 0.5);
      camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 320);   // never inside the slope
      camera.lookAt(target);
      // scan line sweeps from the north edge (z = -maxy) to the south edge over the first 82% of the scroll
      uScan.value = -b[4] + (b[4] - b[1]) * (0.3 + 0.7 * Math.min(1, t / 0.85)) + 70 * Math.sin(s * 1.3) - 2200 * (1 - k);   // the scan line sweeps across the massif during the intro
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
