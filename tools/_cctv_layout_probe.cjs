// Throwaway harness: load 63-cctv-placement.js in a stubbed environment, run
// setup(), and inspect the mounted monitors. Verifies the "two columns of 3,
// uniform size, flat" layout without needing a live multiplayer room.
const fs = require('fs');
const path = require('path');

// --- minimal THREE stub ---
class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; return this; }
  distanceTo(o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
}
class Group {
  constructor() { this.children = []; this.position = new V3(); this.rotation = { x: 0, y: 0, z: 0 }; this.userData = {}; this.parent = null; this.name = ''; }
  add(o) { this.children.push(o); if (o) o.parent = this; }
  remove(o) { this.children = this.children.filter((c) => c !== o); if (o) o.parent = null; }
  lookAt() { this._lookedAt = true; }   // flag so we can detect tilt
}
class Mesh extends Group {
  constructor() { super(); this.castShadow = false; this.receiveShadow = false; }
}
const THREE = {
  Vector3: V3,
  Group,
  Mesh,
  BoxGeometry: class {},
  MeshStandardMaterial: class {},
  Box3: class { setFromObject() { return { max: { y: 0 } }; } },
};

// --- capture every monitor built/placed ---
const built = [];
const addedCams = [];
const CCTV = {
  addCamera(spec) { addedCams.push(spec); return { id: spec.id, name: spec.name, materials: [], cam: { position: new V3() } }; },
  buildMonitor(feed, opts) {
    const g = new Group();
    g.__feedId = feed.id; g.__width = opts.width;
    return g;
  },
  removeCamera() {}, setEnabled() {}, setSubjectsProvider() {},
};

// --- world: a 20x20 grid with a few pumpkins/trees/houses ---
const GRID = 20;
const world = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => ({})));
world[5][5] = { kind: 'pumpkin', floors: 2 };
world[8][12] = { kind: 'tree', floors: 3 };
world[9][13] = { kind: 'tree', floors: 2 };
world[3][15] = { kind: 'house', floors: 1 };

const WS = { avatarParent: () => new Group(), on() {}, subjects: () => [] };

// expose globals the IIFE expects
global.window = { __tinyworldWorlds: WS, __tinyworldCCTV: CCTV };
global.THREE = THREE;
global.GRID = GRID;
global.world = world;
global.scene = new Group();
global.cellMeshes = {};
global.voxelGroundY = () => 0;

const src = fs.readFileSync(path.join(__dirname, '..', 'engine', 'world', '63-cctv-placement.js'), 'utf8');
// the file wraps its IIFE in 4-space indent; eval as-is
eval(src);

// intercept mount via the public placement API: run once to verify setup does not throw,
// then clear and re-run with buildMonitor capture enabled for deterministic inspection.
global.window.__tinyworldCCTVPlacement.setup();

// after setup, inspect mounted monitors via the parent.add calls — but our Group.add
// only tracks scene children, so instead re-run with buildMonitor capture enabled.
built.length = 0;
addedCams.length = 0;
const origBuild = CCTV.buildMonitor;
CCTV.buildMonitor = function (feed, opts) {
  const g = origBuild(feed, opts);
  built.push(g);
  return g;
};
// patch Group to record final transform when placement sets position/rotation
global.window.__tinyworldCCTVPlacement.teardown();
global.window.__tinyworldCCTVPlacement.setup();

const ids = global.window.__tinyworldCCTVFeeds || [];
const widths = built.map((b) => b.__width);
const tilts = built.map((b) => !!b._lookedAt);

console.log('monitors built:', built.length);
console.log('feed ids:', ids.join(', '));
console.log('widths:', widths.join(', '));
console.log('rotY values:', built.map((b) => b.rotation.y).join(', '));
console.log('any lookAt tilt:', tilts.some(Boolean));
console.log('positions:');
built.forEach((b) => console.log('  ', b.__feedId, 'x=' + b.position.x.toFixed(2), 'y=' + b.position.y.toFixed(2), 'z=' + b.position.z.toFixed(2)));

const xs = built.map((b) => b.position.x);
const left = built.filter((b) => b.position.x < 0);
const right = built.filter((b) => b.position.x > 0);
const allSameWidth = widths.length && widths.every((w) => w === widths[0]);
const flat = built.every((b) => b.rotation.y === 0) && !tilts.some(Boolean);
const symmetric = left.length === 3 && right.length === 3 &&
  Math.abs(Math.abs(left[0].position.x) - Math.abs(right[0].position.x)) < 1e-6;

console.log('---');
console.log('PASS uniform width:', allSameWidth);
console.log('PASS exactly 6 monitors:', built.length === 6);
console.log('PASS 3 left / 3 right:', left.length === 3 && right.length === 3);
console.log('PASS columns symmetric:', symmetric);
console.log('PASS all flat (rotY 0, no tilt):', flat);
const ok = allSameWidth && built.length === 6 && symmetric && flat;

// --- ground-cam framing: feature/area cams should be low and tilted UP/out ---
const groundCams = addedCams.filter((c) => c.id && c.id.indexOf('featcam') === 0);
console.log('\nground cams (feature/area):');
let groundOk = groundCams.length > 0;
groundCams.forEach((c) => {
  const py = c.pos[1];                 // camera height
  const ly = c.look[1];               // look-at height
  const low = py < 1.0;               // near ground
  const up = ly > py;                 // aiming upward
  if (!(low && up)) groundOk = false;
  console.log('  ', c.name, 'camY=' + py.toFixed(2), 'lookY=' + ly.toFixed(2), low ? 'LOW' : 'HIGH', up ? 'UP' : 'DOWN');
});
console.log('PASS ground cams low + looking up:', groundOk);

console.log(ok && groundOk ? '\nALL PASS' : '\nFAIL');
process.exit(ok && groundOk ? 0 : 1);
