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

test('only the four existing clouds and moon are animation targets', () => {
  const ids = [...css.matchAll(/data-scene-layer="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(new Set(ids), new Set([
    '01-moon', '02-cloud-upper-left', '03-cloud-lower-left', '04-cloud-center', '05-cloud-right',
  ]));
  ids.forEach(id => assert.ok(scene.layers.some(layer => layer.id === id)));
  assert.equal(scene.layers.filter(layer => layer.id.includes('-cloud-')).length, 4);
  assert.equal(scene.layers.length, 18);
});

test('motion is mobile-only and opt-in to no reduced-motion preference', () => {
  const media = css.indexOf('@media (max-width: 640px) and (prefers-reduced-motion: no-preference)');
  assert.ok(media > 0);
  assert.equal(/animation\s*:/.test(css.slice(0, media)), false);
  assert.equal((css.slice(media).match(/animation-play-state: var\(--garden-motion-state, paused\)/g) || []).length, 2);
  assert.match(css, /0%, 100% \{ transform: translateX\(0\); \}/);
  assert.match(css, /0%, 100% \{ transform: translate\(0, 0\); \}/);
});

test('clouds stay in the sky and the moon stays within its original neighborhood', () => {
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
  assert.match(css, /translate\(-6px, -8px\)/);
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
