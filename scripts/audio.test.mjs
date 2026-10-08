import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeAudio, pauseAudio, playingAudio } from '../audio.js';

class Control extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  click() {
    this.dispatchEvent(new Event('click'));
  }
}
class Audio extends EventTarget {
  paused = true;
  duration = 5;
  currentTime = 0;
  readyState = 4;
  isConnected = true;
  loads = 0;
  async play() {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  }
  pause() {
    if (!this.paused) {
      this.paused = true;
      this.dispatchEvent(new Event('pause'));
    }
  }
  load() {
    this.loads++;
  }
}
function player(label) {
  const classes = new Set(),
    audio = new Audio(),
    button = new Control(),
    seek = new Control(),
    time = {};
  return {
    audio,
    button,
    seek,
    time,
    hidden: false,
    dataset: { label, duration: 5 },
    classList: {
      contains: (name) => classes.has(name),
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, enabled) => (enabled ? classes.add(name) : classes.delete(name)),
    },
    querySelector: (selector) =>
      ({ 'audio': audio, '.audio-play': button, '.audio-seek': seek, '.audio-time': time })[
        selector
      ],
    closest() {
      return this.hidden ? this : null;
    },
  };
}
function setup() {
  pauseAudio();
  const a = player('generated audio A13'),
    b = player('generated audio A14'),
    messages = [],
    holds = [];
  initializeAudio(
    { querySelectorAll: () => [a, b] },
    {
      onPlay: (p) => holds.push(p),
      announce: (...value) => messages.push(value),
      clearAnnouncement: () => {},
    },
  );
  return { a, b, messages, holds };
}
const settle = () => new Promise(setImmediate);

test('external media play transfers ownership and pauses the previous audio', async () => {
  const { a, b, holds } = setup();
  await a.audio.play();
  await b.audio.play();
  assert(a.audio.paused);
  assert.equal(playingAudio(), b.audio);
  assert.deepEqual(holds, [a, b]);
  b.audio.pause();
  assert.equal(playingAudio(), null);
});

test('media keys cannot restart an inactive sample or interrupt the visible audio', async () => {
  const { a, b, holds } = setup();
  await b.audio.play();
  a.hidden = true;
  await a.audio.play();
  assert(a.audio.paused);
  assert.equal(playingAudio(), b.audio);
  assert.deepEqual(holds, [b]);
});

test('a network error after playback starts has a recoverable error state', async () => {
  const { a, messages } = setup();
  await a.audio.play();
  a.audio.dispatchEvent(new Event('error'));
  assert.equal(playingAudio(), null);
  assert.equal(a.time.textContent, 'Unable to play. Retry.');
  assert.equal(messages.length, 1);
  a.button.click();
  await settle();
  assert.equal(a.audio.loads, 1);
  assert.equal(playingAudio(), a.audio);
  assert(!a.classList.contains('has-error'));
});

test('a rejected play request reports failure, while cancellation stays silent', async () => {
  const { a, messages } = setup();
  a.audio.play = async () => {
    throw Object.assign(new Error(), { name: 'NotSupportedError' });
  };
  a.button.click();
  await settle();
  assert.equal(messages.length, 1);
  assert(a.classList.contains('has-error'));
  const next = setup();
  next.a.audio.play = async () => {
    throw Object.assign(new Error(), { name: 'AbortError' });
  };
  next.a.button.click();
  await settle();
  assert.deepEqual(next.messages, []);
});

test('seeking updates playback time and its accessible value', async () => {
  const { a } = setup();
  await a.audio.play();
  a.seek.value = '500';
  a.seek.dispatchEvent(new Event('input'));
  assert.equal(a.audio.currentTime, 2.5);
  assert.equal(a.seek.attributes.get('aria-valuetext'), '0:02 of 0:05');
});
