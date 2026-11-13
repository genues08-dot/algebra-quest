// Cuts pet sheets into the app's pet pictures, and measures where each head is for hats.
// A sheet is 3 rows (colors) x 4 columns (moods: happy, cheer, encourage, think) of drawings on a
// plain light background, with labels above and to the left, like the ones the user drew on 2026-11-13.
// Usage: node tools/cut-pets.js <sheets.json> [petId ...]
//   sheets.json: { "duck": { "file": "C:/path/duck.png", "colors": ["pekin", "mallard", "black"] }, ... }
//   Optional per sheet: "clearLeft": a pixel column; everything left of it is ignored (a label that
//   touches a drawing).
// Writes img/pets/<pet>-<color>-<mood>.png (240 x 240), img/pets/<pet>-<color>-thumb.png (96 x 96),
// and js/pet-heads.js. Add the pet and its colors to PETS in js/mascot.js by hand.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const png = require('./png.js');
let SHEETS = {};
const MOODS = ['happy', 'cheer', 'encourage', 'think'];
const SIZE = 240, THUMB = 96, MARGIN = 8;
const BG_TOL = 9;        // max channel difference from the background that still counts as background
const EDGE_RANGE = 48;   // edge pixels within this difference get partial transparency

function cutSheet(pet, outDir) {
  // clearLeft: columns left of it hold only labels (the "Little Blue" label touches its penguin).
  const { file, colors, clearLeft } = SHEETS[pet];
  const im = png.read(file);
  const { width: W, height: H, data: d } = im;
  // Background colour: the mean of the four corner patches.
  const bg = [0, 0, 0];
  let n = 0;
  for (const [cx, cy] of [[2, 2], [W - 22, 2], [2, H - 22], [W - 22, H - 22]]) {
    for (let y = cy; y < cy + 20; y++) for (let x = cx; x < cx + 20; x++) {
      const o = (y * W + x) * 4;
      bg[0] += d[o]; bg[1] += d[o + 1]; bg[2] += d[o + 2]; n++;
    }
  }
  for (let k = 0; k < 3; k++) bg[k] /= n;
  const diff = i => Math.max(Math.abs(d[i * 4] - bg[0]), Math.abs(d[i * 4 + 1] - bg[1]), Math.abs(d[i * 4 + 2] - bg[2]));

  // Flood the background in from the edges, so light fur inside an outline stays.
  const isBg = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (isBg[i] || diff(i) > BG_TOL) continue;
    isBg[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }

  if (clearLeft) for (let y = 0; y < H; y++) for (let x = 0; x < clearLeft; x++) isBg[y * W + x] = 1;

  // Connected pieces of everything else.
  const comp = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let i = 0; i < W * H; i++) {
    if (isBg[i] || comp[i] !== -1) continue;
    const c = { id: comps.length, area: 0, x0: W, y0: H, x1: 0, y1: 0, sx: 0, sy: 0 };
    comps.push(c);
    const st = [i];
    comp[i] = c.id;
    while (st.length) {
      const j = st.pop();
      const x = j % W, y = (j / W) | 0;
      c.area++; c.sx += x; c.sy += y;
      if (d[j * 4] >= 60 && d[j * 4] <= 150 && d[j * 4 + 1] <= 70 && d[j * 4 + 2] >= 35 && d[j * 4 + 2] <= 120) c.purple = (c.purple || 0) + 1;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (!isBg[k] && comp[k] === -1) { comp[k] = c.id; st.push(k); }
      }
    }
  }
  // Drop the title, the mood headers, and the color labels.
  // Label pills are big dark purple shapes in the header band or the left column. (A question
  // mark is purple too, but small; dark brown fur can look purple, but sits elsewhere.)
  const isLabel = c => c.area > 1500 && (c.purple || 0) / c.area > 0.35 && (c.y1 < 0.2 * H || c.x1 < 0.2 * W);
  const kept = comps.filter(c => c.y1 > 0.16 * H && c.x1 > 0.155 * W && c.area >= 12 && !isLabel(c));
  const animals = kept.slice().sort((a, b) => b.area - a.area).slice(0, 12);
  if (animals.length !== 12) throw new Error(pet + ': found ' + animals.length + ' animals');
  const cy = c => c.sy / c.area, cx = c => c.sx / c.area;
  animals.sort((a, b) => cy(a) - cy(b));
  const grid = [0, 1, 2].map(r => animals.slice(r * 4, r * 4 + 4).sort((a, b) => cx(a) - cx(b)));
  // Small pieces (confetti, question marks, motion lines) go with the nearest animal.
  const extras = new Map(animals.map(a => [a.id, []]));
  for (const c of kept) {
    if (animals.includes(c)) continue;
    let best = null, bestD = Infinity;
    for (const a of animals) {
      const dx = Math.max(a.x0 - cx(c), 0, cx(c) - a.x1), dy = Math.max(a.y0 - cy(c), 0, cy(c) - a.y1);
      const dist = Math.hypot(dx, dy);
      if (dist < bestD) { bestD = dist; best = a; }
    }
    if (best && bestD < 70) extras.get(best.id).push(c);
  }
  // One scale for the whole sheet, so the moods match in size.
  const boxes = grid.flat().map(a => {
    const all = [a].concat(extras.get(a.id));
    return { a, all, x0: Math.min(...all.map(c => c.x0)), y0: Math.min(...all.map(c => c.y0)),
      x1: Math.max(...all.map(c => c.x1)), y1: Math.max(...all.map(c => c.y1)) };
  });
  // One scale for the whole sheet from the tallest picture, so the moods match in size. A picture
  // too wide for it (the penguin sliding on its belly) gets its own smaller scale.
  const sheetScale = (SIZE - 2 * MARGIN) / Math.max(...boxes.map(b => b.y1 - b.y0 + 1));

  const heads = {};
  boxes.forEach((b, idx) => {
    const color = colors[Math.floor(idx / 4)], mood = MOODS[idx % 4];
    const ids = new Set(b.all.map(c => c.id));
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    const scale = Math.min(sheetScale, (SIZE - 2 * MARGIN) / bw);
    // Source pixels as premultiplied RGBA, with soft edges against the background.
    const src = new Float32Array(bw * bh * 4);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = (b.y0 + y) * W + (b.x0 + x);
      if (!ids.has(comp[i])) continue;
      let alpha = 1;
      const edge = isBg[i - 1] || isBg[i + 1] || isBg[i - W] || isBg[i + W];
      if (edge) alpha = Math.min(1, diff(i) / EDGE_RANGE);
      const o = (y * bw + x) * 4;
      for (let k = 0; k < 3; k++) {
        const c = alpha > 0 ? (d[i * 4 + k] - (1 - alpha) * bg[k]) / alpha : 0;
        src[o + k] = Math.max(0, Math.min(255, c)) * alpha;
      }
      src[o + 3] = alpha;
    }
    // Place: centered across, feet on the bottom margin.
    const ow = bw * scale, oh = bh * scale;
    const left = (SIZE - ow) / 2, top = SIZE - MARGIN - oh;
    const out = resample(src, bw, bh, SIZE, SIZE, left, top, scale);
    png.write(path.join(outDir, pet + '-' + color + '-' + mood + '.png'), out);
    if (mood === 'happy') {
      const t = resample(src, bw, bh, THUMB, THUMB, left * THUMB / SIZE, top * THUMB / SIZE, scale * THUMB / SIZE);
      png.write(path.join(outDir, pet + '-' + color + '-thumb.png'), t);
    }
    heads[pet + '-' + color + '-' + mood] = measureHead(comp, W, b.a, scale, left - b.x0 * scale, top - b.y0 * scale);
  });
  return heads;
}

// Box-filter resample of premultiplied RGBA into a w x h picture at (left, top), scaled by s.
function resample(src, sw, sh, w, h, left, top, s) {
  const acc = new Float64Array(w * h * 4);
  const wsum = new Float64Array(w * h);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const o = (y * sw + x) * 4;
    // Each source pixel covers [x0,x1) x [y0,y1) in the output.
    const x0 = left + x * s, x1 = x0 + s, y0 = top + y * s, y1 = y0 + s;
    for (let oy = Math.floor(y0); oy < Math.ceil(y1); oy++) {
      if (oy < 0 || oy >= h) continue;
      const cy = Math.min(y1, oy + 1) - Math.max(y0, oy);
      for (let ox = Math.floor(x0); ox < Math.ceil(x1); ox++) {
        if (ox < 0 || ox >= w) continue;
        const cov = cy * (Math.min(x1, ox + 1) - Math.max(x0, ox));
        if (cov <= 0) continue;
        const p = (oy * w + ox) * 4;
        acc[p] += src[o] * cov; acc[p + 1] += src[o + 1] * cov; acc[p + 2] += src[o + 2] * cov; acc[p + 3] += src[o + 3] * cov;
      }
    }
  }
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = Math.min(1, acc[i * 4 + 3]);
    if (a <= 0.004) continue;
    for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.round(Math.min(255, acc[i * 4 + k] / acc[i * 4 + 3]));
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return { width: w, height: h, data: out };
}

// Where the head is, as fractions of the 240 picture: the first row from the top where the
// animal is wide enough to be a head (not an ear, horn, or comb), its centre, and its width.
function measureHead(comp, W, animal, s, offX, offY) {
  const aw = animal.x1 - animal.x0 + 1, ah = animal.y1 - animal.y0 + 1;
  const runAt = y => {
    let best = null, start = -1;
    for (let x = animal.x0; x <= animal.x1 + 1; x++) {
      const on = x <= animal.x1 && comp[y * W + x] === animal.id;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (!best || x - start > best.len) best = { start, len: x - start };
        start = -1;
      }
    }
    return best;
  };
  let headTop = animal.y0, run = runAt(animal.y0);
  for (let y = animal.y0; y < animal.y0 + ah * 0.5; y++) {
    const r = runAt(y);
    if (r && r.len >= 0.3 * aw) { headTop = y; run = r; break; }
  }
  // Width a little lower down, where the head is fullest.
  const lower = runAt(Math.min(animal.y1, Math.round(headTop + ah * 0.08))) || run;
  const centre = lower.start + lower.len / 2;
  return {
    x: +((centre * s + offX) / SIZE).toFixed(3),
    y: +((headTop * s + offY) / SIZE).toFixed(3),
    w: +((lower.len * s) / SIZE).toFixed(3)
  };
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'img', 'pets');
const HEADS_FILE = path.join(ROOT, 'js', 'pet-heads.js');
SHEETS = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pets = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(SHEETS);
fs.mkdirSync(OUT, { recursive: true });
let heads = {};
if (fs.existsSync(HEADS_FILE)) heads = JSON.parse(fs.readFileSync(HEADS_FILE, 'utf8').match(/= (\{[\s\S]*\});/)[1]);
for (const pet of pets) {
  Object.assign(heads, cutSheet(pet, OUT));
  console.log('cut ' + pet);
}
const sorted = {};
Object.keys(heads).sort().forEach(k => { sorted[k] = heads[k]; });
fs.writeFileSync(HEADS_FILE, [
  "// Generated by tools/cut-pets.js. Where each pet picture's head is, for hats: fractions of the",
  "// picture, x the head's centre, y its top, w its width. Fixes by eye go in HEAD_FIXES in js/views.js.",
  '(function (root) {',
  '  var AQ = root.AQ = root.AQ || {};',
  '  AQ.PET_HEADS = ' + JSON.stringify(sorted) + ';',
  "})(typeof window !== 'undefined' ? window : globalThis);",
  ''
].join('\n'), 'utf8');
