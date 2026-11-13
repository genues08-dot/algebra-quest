// Turns the pet sprites into the app's pet pictures, and measures where each head is for hats.
// The sprites are the folder the user made on 2026-11-13 (Algebra-Quest-Pet-Sprites.zip, unzipped):
//   individual-pngs/<pet>/<row>-<mood>.png, 400 x 400 with a transparent background, where <pet> is a
//   PETS id in js/mascot.js, <row> 1-3 is the color in PETS order, and <mood> is happy, cheering,
//   encouraging, or thinking.
// Usage: node tools/cut-pets.js <sprite folder> [petId ...]
// Writes img/axl/<color>-<mood>.png for the axolotl, img/pets/<pet>-<color>-<mood>.png (240 x 240) and
// img/pets/<pet>-<color>-thumb.png (96 x 96) for the rest, and js/pet-heads.js. A new pet must be in
// PETS first.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const png = require('./png.js');
require('../js/mascot.js');
const mascot = globalThis.AQ.mascot;

const MOODS = { happy: 'happy', cheer: 'cheering', encourage: 'encouraging', think: 'thinking' };
const SIZE = 240, THUMB = 96, MARGIN = 8;
const SOLID = 128;  // alpha at or above this counts as the animal, for measuring

// Heads fixed by eye where the measuring goes wrong, in the sprite's own 400 x 400 pixels: x the
// head's centre, y its top, w its width. Keyed "<look>-<mood>" for one picture, "<pet>-<mood>" for a
// mood in every color, or "<pet>" for every picture of a pet. A field left out stays as measured.
const HEAD_FIXES = {
  // The gills are not head.
  'axolotl': { w: 150 },
  // The ears stick out sideways; the hat goes between the horns.
  'giraffe-happy': { x: 197, y: 96, w: 105 },
  'giraffe-cheer': { x: 192, y: 92, w: 105 },
  'cow-happy': { x: 200, y: 72, w: 105 },
  'cow-cheer': { x: 193, y: 68, w: 105 },
  'cow-encourage': { x: 200, y: 78, w: 105 },
  'cow-think': { x: 200, y: 75, w: 105 },
  // The sliding penguin lies on its belly, with its head at the front.
  'penguin-cheer': { x: 237, y: 120, w: 120 },
  // The rockhopper's crest is not head.
  'penguin-rockhopper-happy': { x: 205, y: 70, w: 125 },
  'penguin-rockhopper-encourage': { x: 215, y: 75, w: 125 },
  'penguin-rockhopper-think': { x: 215, y: 72, w: 125 }
};

function cutPet(dir, pet) {
  const cells = [];
  pet.colors.forEach((pair, row) => {
    Object.keys(MOODS).forEach(mood => {
      const im = png.read(path.join(dir, 'individual-pngs', pet.id, (row + 1) + '-' + MOODS[mood] + '.png'));
      cells.push({ color: pair[0], mood, im, box: boxOf(im) });
    });
  });
  // One crop and one scale for the pet: the box around all 12 drawings. Every color and mood keeps
  // the place the artist drew it in, so the pet does not jump about when its mood changes.
  const x0 = Math.min(...cells.map(c => c.box.x0)), y0 = Math.min(...cells.map(c => c.box.y0));
  const x1 = Math.max(...cells.map(c => c.box.x1)), y1 = Math.max(...cells.map(c => c.box.y1));
  const scale = (SIZE - 2 * MARGIN) / Math.max(x1 - x0 + 1, y1 - y0 + 1);
  // Centered across, feet on the bottom margin.
  const left = (SIZE - (x1 - x0 + 1) * scale) / 2 - x0 * scale;
  const top = SIZE - MARGIN - (y1 + 1) * scale;

  const heads = {};
  for (const c of cells) {
    const look = pet.id === 'axolotl' ? c.color : pet.id + '-' + c.color;
    const src = premultiplied(c.im);
    const file = pet.id === 'axolotl' ? path.join(ROOT, 'img', 'axl', c.color + '-' + c.mood + '.png')
      : path.join(ROOT, 'img', 'pets', look + '-' + c.mood + '.png');
    png.write(file, resample(src, c.im.width, c.im.height, SIZE, SIZE, left, top, scale));
    if (c.mood === 'happy' && pet.id !== 'axolotl') {
      const k = THUMB / SIZE;
      png.write(path.join(ROOT, 'img', 'pets', look + '-thumb.png'),
        resample(src, c.im.width, c.im.height, THUMB, THUMB, left * k, top * k, scale * k));
    }
    const fix = HEAD_FIXES[look + '-' + c.mood] || HEAD_FIXES[pet.id + '-' + c.mood] || HEAD_FIXES[pet.id] || {};
    const head = measureHead(c.im, c.box, scale, left, top);
    if ('x' in fix) head.x = +((fix.x * scale + left) / SIZE).toFixed(3);
    if ('y' in fix) head.y = +((fix.y * scale + top) / SIZE).toFixed(3);
    if ('w' in fix) head.w = +((fix.w * scale) / SIZE).toFixed(3);
    heads[look + '-' + c.mood] = head;
  }
  return heads;
}

// The box around the solid part of a picture.
function boxOf(im) {
  const { width: W, height: H, data: d } = im;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] < SOLID) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('empty picture');
  return { x0, y0, x1, y1 };
}

// RGBA 0-255 to premultiplied floats (colour 0-255 times alpha 0-1).
function premultiplied(im) {
  const n = im.width * im.height;
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = im.data[i * 4 + 3] / 255;
    for (let k = 0; k < 3; k++) out[i * 4 + k] = im.data[i * 4 + k] * a;
    out[i * 4 + 3] = a;
  }
  return out;
}

// Box-filter resample of premultiplied RGBA into a w x h picture at (left, top), scaled by s.
function resample(src, sw, sh, w, h, left, top, s) {
  const acc = new Float64Array(w * h * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const o = (y * sw + x) * 4;
    if (src[o + 3] === 0) continue;
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
function measureHead(im, box, s, offX, offY) {
  const { width: W, data: d } = im;
  const aw = box.x1 - box.x0 + 1, ah = box.y1 - box.y0 + 1;
  const runAt = y => {
    let best = null, start = -1;
    for (let x = box.x0; x <= box.x1 + 1; x++) {
      const on = x <= box.x1 && d[(y * W + x) * 4 + 3] >= SOLID;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (!best || x - start > best.len) best = { start, len: x - start };
        start = -1;
      }
    }
    return best;
  };
  let headTop = box.y0, run = runAt(box.y0);
  for (let y = box.y0; y < box.y0 + ah * 0.5; y++) {
    const r = runAt(y);
    if (r && r.len >= 0.3 * aw) { headTop = y; run = r; break; }
  }
  // Width a little lower down, where the head is fullest.
  const lower = runAt(Math.min(box.y1, Math.round(headTop + ah * 0.08))) || run;
  const centre = lower.start + lower.len / 2;
  return {
    x: +((centre * s + offX) / SIZE).toFixed(3),
    y: +((headTop * s + offY) / SIZE).toFixed(3),
    w: +((lower.len * s) / SIZE).toFixed(3)
  };
}

const ROOT = path.join(__dirname, '..');
const HEADS_FILE = path.join(ROOT, 'js', 'pet-heads.js');
const dir = process.argv[2];
if (!dir) throw new Error('Usage: node tools/cut-pets.js <sprite folder> [petId ...]');
const ids = process.argv.slice(3).length ? process.argv.slice(3) : mascot.PETS.map(p => p.id);
fs.mkdirSync(path.join(ROOT, 'img', 'pets'), { recursive: true });
let heads = {};
if (fs.existsSync(HEADS_FILE)) heads = JSON.parse(fs.readFileSync(HEADS_FILE, 'utf8').match(/= (\{[\s\S]*\});/)[1]);
for (const id of ids) {
  const pet = mascot.PETS.find(p => p.id === id);
  if (!pet) throw new Error(id + ' is not in PETS in js/mascot.js');
  Object.assign(heads, cutPet(dir, pet));
  console.log('cut ' + id);
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
