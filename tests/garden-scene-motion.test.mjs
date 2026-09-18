import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { observeGardenVisibility } from '../src/garden-scene-motion.js';

const scene = JSON.parse(readFileSync(new URL('../src/garden-scene-layers.json', import.meta.url)));
const css = readFileSync(new URL('../src/garden-scene-motion.css', import.meta.url), 'utf8');

function environment(t, supportsIntersection = true) {
  const oldDocument = globalThis.document;
  const oldObserver = globalThis.IntersectionObserver;
  const listeners = new Map();
  const values = new Map();
  const element = { style: { setProperty: (key, value) => values.set(key, value) } };
  let callback, observed, disconnected = false;
  globalThis.document = {
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => {
      assert.equal(listeners.get(name), fn);
      listeners.delete(name);
    },
  };
  globalThis.IntersectionObserver = supportsIntersection ? class {
    constructor(fn) { callback = fn; }
    observe(node) { observed = node; }
    disconnect() { disconnected = true; }
  } : undefined;
  t.after(() => {
    globalThis.document = oldDocument;
    globalThis.IntersectionObserver = oldObserver;
  });
  return {
    element, listeners,
    state: () => values.get('--garden-motion-state'),
    observed: () => observed,
    disconnected: () => disconnected,
    inView: (value) => callback([{ isIntersecting: value }]),
    hidden: (value) => {
      document.hidden = value;
      listeners.get('visibilitychange')();
    },
  };
}

test('only the four existing clouds, moon and wind sprite are animation targets', () => {
  const ids = [...css.matchAll(/data-scene-layer="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(new Set(ids), new Set([
    '01-moon', '02-cloud-upper-left', '03-cloud-lower-left', '04-cloud-center', '05-cloud-right', '13-wind-leaves',
  ]));
  ids.forEach(id => assert.ok(scene.layers.some(layer => layer.id === id)));
  assert.equal(scene.layers.filter(layer => layer.id.includes('-cloud-')).length, 4);
  assert.equal(scene.layers.length, 18);
});

test('motion is mobile-only and opt-in to no reduced-motion preference', () => {
  const media = css.indexOf('@media (max-width: 640px) and (prefers-reduced-motion: no-preference)');
  assert.ok(media > 0);
  assert.equal(/animation\s*:/.test(css.slice(0, media)), false);
  assert.equal((css.slice(media).match(/animation-play-state: var\(--garden-motion-state, paused\)/g) || []).length, 3);
  assert.match(css, /0%, 100% \{ transform: translateX\(0\); \}/);
  assert.match(css, /0%, 100% \{ transform: translate\(0, 0\); \}/);
});

test('clouds stay in the sky with their existing slow drift', () => {
  const cloudRules = [...css.matchAll(/data-scene-layer="([^"]*cloud[^"]*)"\]\s*\{\s*--cloud-drift:\s*(\d+)px;\s*--cloud-duration:\s*(\d+)s;/g)];
  assert.equal(cloudRules.length, 4);
  for (const [, id, drift, duration] of cloudRules) {
    const layer = scene.layers.find(layer => layer.id === id);
    assert.ok(Number(duration) >= 40);
    assert.ok(Number(drift) <= 80);
    assert.ok(layer.y + layer.height < 340);
    assert.ok(layer.x + Number(drift) < scene.canvas.width);
    assert.ok(layer.x + layer.width > 0);
  }
});

test('moon follows a visible but bounded arc away from the date card', () => {
  const moon = scene.layers.find(layer => layer.id === '01-moon');
  const keyframes = css.slice(css.indexOf('@keyframes qd-garden-moon-float'), css.indexOf('@keyframes qd-garden-breeze'));
  const offsets = [...keyframes.matchAll(/translate\((-?\d+)px, (-?\d+)px\)/g)]
    .map(([, x, y]) => [Number(x), Number(y)]);
  assert.equal(offsets.length, 3);
  assert.equal(Math.min(...offsets.map(([x]) => x)), -40);
  for (const [x, y] of offsets) {
    assert.ok(x <= 0 && x >= -40);
    assert.ok(y >= 0 && y <= 24);
    assert.ok(moon.x + x > 550, 'keep clear of the greeting on the left');
    assert.ok(moon.y + y + moon.height < 250, 'stay above the lower clouds');
  }
  assert.match(css, /qd-garden-moon-float 24s ease-in-out infinite/);
  assert.match(css, /animation-delay: -4s/);
});

test('breeze reuses the existing leaves without changing the layer layout', () => {
  const wind = scene.layers.find(layer => layer.id === '13-wind-leaves');
  assert.deepEqual([wind.x, wind.y, wind.width, wind.height], [410, 742, 117, 31]);
  assert.equal(wind.src, '/garden-scene/v1/13-wind-leaves.webp');
  const keyframes = css.slice(css.indexOf('@keyframes qd-garden-breeze'), css.indexOf('@media'));
  const offsets = [...keyframes.matchAll(/translate\((-?\d+)px, (-?\d+)px\)/g)]
    .map(([, x, y]) => [Number(x), Number(y)]);
  assert.equal(offsets.length, 5);
  offsets.forEach(([x, y], index) => {
    assert.ok(wind.x + x >= 0);
    assert.ok(wind.x + x + wind.width <= scene.canvas.width);
    assert.ok(wind.y + y >= 500, 'stay below the greeting, moon and calendar');
    assert.ok(wind.y + y + wind.height < 600, 'stay above the XP bar');
    if (index > 0) assert.ok(x > offsets[index - 1][0], 'travel with the breeze, never backwards');
  });
});

test('breeze fades before resetting and exposes a shared cycle for later plant sway', () => {
  const keyframes = css.slice(css.indexOf('@keyframes qd-garden-breeze'), css.indexOf('@media'));
  assert.match(keyframes, /0%, 8%\s*\{[^}]*opacity: 0;/);
  assert.match(keyframes, /76%, 100%\s*\{[^}]*opacity: 0;/);
  assert.match(css, /--garden-breeze-duration: 14s/);
  assert.match(css, /--garden-breeze-delay: -3\.5s/);
  assert.match(css, /qd-garden-breeze var\(--garden-breeze-duration\) linear infinite/);
  assert.match(css, /animation-delay: var\(--garden-breeze-delay\)/);
  const opacities = [...keyframes.matchAll(/opacity: ([\d.]+);/g)].map(([, value]) => Number(value));
  assert.ok(opacities.every(value => value >= 0 && value <= .8));
});

test('pause and resume follow both intersection and tab visibility', (t) => {
  const env = environment(t);
  const cleanup = observeGardenVisibility(env.element);
  assert.equal(env.observed(), env.element);
  assert.equal(env.state(), 'running');
  env.inView(false);
  assert.equal(env.state(), 'paused');
  env.hidden(true);
  env.inView(true);
  assert.equal(env.state(), 'paused');
  env.hidden(false);
  assert.equal(env.state(), 'running');
  env.hidden(true);
  assert.equal(env.state(), 'paused');
  cleanup();
  assert.equal(env.disconnected(), true);
  assert.equal(env.listeners.size, 0);
});

test('tab visibility works even without IntersectionObserver', (t) => {
  const env = environment(t, false);
  const cleanup = observeGardenVisibility(env.element);
  env.hidden(true);
  assert.equal(env.state(), 'paused');
  env.hidden(false);
  assert.equal(env.state(), 'running');
  cleanup();
});

test('missing element is a safe no-op', () => {
  assert.doesNotThrow(observeGardenVisibility(null));
});
