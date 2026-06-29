import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const cycleJs = readFileSync(new URL('../engine/world/26c-island-view-time-cycle.js', import.meta.url), 'utf8');
const bootJs = readFileSync(new URL('../engine/world/30-ui-boot-wiring.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../tiny-world-builder.html', import.meta.url), 'utf8');
const animateJs = readFileSync(new URL('../engine/world/25-animation-loop-schema.js', import.meta.url), 'utf8');

function loadCycleApi(bodyClasses = []) {
  const classSet = new Set(bodyClasses);
  const ctx = {
    document: {
      body: {
        classList: {
          contains(name) { return classSet.has(name); },
        },
      },
    },
    window: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(cycleJs, ctx);
  return ctx.window.__tinyworldIslandViewTimeCycle;
}

test('island view time cycle maps 30 real minutes to a full virtual day starting at midday', () => {
  const cycle = loadCycleApi(['tinyverse-collectible']);
  assert.equal(cycle.ISLAND_VIEW_CYCLE_MS, 30 * 60 * 1000);
  assert.equal(cycle.ISLAND_VIEW_PHASE_NIGHT_MS, 10 * 60 * 1000);
  assert.equal(cycle.isIslandViewTimeCycleContext(), true);
  assert.equal(cycle.islandViewTodMinutesFromElapsed(0), 720);
  assert.equal(Math.round(cycle.islandViewTodMinutesFromElapsed(12 * 60 * 1000)), 1260);
  assert.equal(Math.round(cycle.islandViewTodMinutesFromElapsed(22 * 60 * 1000)), 360);
  assert.equal(Math.round(cycle.islandViewTodMinutesFromElapsed(30 * 60 * 1000)), 720);
});

test('island view night phase stays within 10 real minutes', () => {
  const cycle = loadCycleApi();
  const nightStartMs = 12 * 60 * 1000;
  const nightEndMs = 22 * 60 * 1000;
  const samples = [0, 0.25, 0.5, 0.75, 0.99].map((t) => nightStartMs + t * (nightEndMs - nightStartMs));
  for (const ms of samples) {
    const min = cycle.islandViewTodMinutesFromElapsed(ms);
    const isNight = min < 360 || min >= 1260;
    assert.equal(isNight, true, `expected night at ${ms}ms -> ${min}`);
  }
});

test('builder wires island view cycle module and tick hook', () => {
  assert.match(html, /26c-island-view-time-cycle\.js/);
  assert.match(bootJs, /beginIslandViewTimeCycle/);
  assert.match(bootJs, /__tinyworldTickIslandViewTime/);
  assert.match(animateJs, /__tinyworldTickIslandViewTime/);
});