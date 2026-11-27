// Point-cloud worker: fetch the EPC1 binary, dequantise to Float32 positions (three.js axes: x east, y up, z south),
// per-point intensity 0..1, and a coarse height grid for range readouts. Everything is transferred, nothing copied.
self.onmessage = async (e) => {
  const { url } = e.data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'EPC1') throw new Error('bad magic');
    const n = dv.getUint32(4, true);
    const b = new Float32Array(buf.slice(8, 32));            // minx miny minz maxx maxy maxz (metres)
    const q = new Uint16Array(buf, 32, n * 3);
    const attr = new Uint8Array(buf, 32 + n * 6, n);
    const pos = new Float32Array(n * 3), inten = new Float32Array(n);
    const sx = (b[3] - b[0]) / 65535, sy = (b[4] - b[1]) / 65535, sz = (b[5] - b[2]) / 65535;
    const G = 64, grid = new Float32Array(G * G);
    const ex = b[3] - b[0], ey = b[4] - b[1];
    for (let i = 0; i < n; i++) {
      const x = b[0] + q[i * 3] * sx, y = b[1] + q[i * 3 + 1] * sy, h = q[i * 3 + 2] * sz;
      pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = -y;
      inten[i] = (attr[i] & 63) / 63;
      const gx = Math.min(G - 1, ((x - b[0]) / ex * G) | 0), gy = Math.min(G - 1, ((y - b[1]) / ey * G) | 0);
      const k = gy * G + gx; if (h > grid[k]) grid[k] = h;
    }
    self.postMessage({ n, bounds: Array.from(b), pos, inten, grid, G }, [pos.buffer, inten.buffer, grid.buffer]);
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
};
