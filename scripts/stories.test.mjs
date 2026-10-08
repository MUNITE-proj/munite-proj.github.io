import assert from 'node:assert/strict';
import test from 'node:test';
import { FigureStory, SampleStory } from '../stories.js';

function scene({ width = 1280, height = 800, frameHeight = 500, top = 1000 } = {}) {
  let reduced = false,
    reads = 0;
  const dialog = { open: false },
    classes = new Set(),
    styles = new Map();
  Object.assign(globalThis, {
    innerWidth: width,
    innerHeight: height,
    scrollY: 0,
    matchMedia: (query) => ({
      get matches() {
        return (
          !reduced &&
          innerWidth >= 960 &&
          innerHeight >= Number(query.match(/min-height: (\d+)/)[1])
        );
      },
    }),
    scrollTo: ({ top: value }) => {
      globalThis.scrollY = value;
    },
  });
  const host = {
    querySelector: () => ({
      getBoundingClientRect: () => {
        reads++;
        return { height: frameHeight };
      },
    }),
    getBoundingClientRect: () => {
      reads++;
      return { top: top - scrollY };
    },
    classList: { toggle: (name, enabled) => (enabled ? classes.add(name) : classes.delete(name)) },
    style: {
      setProperty: (name, value) => styles.set(name, value),
      removeProperty: (name) => styles.delete(name),
    },
  };
  return {
    host,
    dialog,
    classes,
    styles,
    get reads() {
      return reads;
    },
    scroll(value, story) {
      globalThis.scrollY = value;
      story.update();
    },
    resize(value, story) {
      globalThis.innerHeight = value;
      story.measure(56);
      story.update();
    },
    move(value, story) {
      top = value;
      story.measure(56);
      story.update();
    },
    reduce(story) {
      reduced = true;
      story.measure(56);
      story.update();
    },
  };
}
const controls = (states) =>
  states.map((state) => {
    let click;
    return {
      dataset: { regime: state },
      addEventListener: (_, callback) => {
        click = callback;
      },
      click: () => click(),
    };
  });

test('figure controls and scrolling reach the same stage, including the shorter final overview', () => {
  const view = scene(),
    stages = [],
    states = ['0', '1', '2', 'overview'],
    buttons = controls(states);
  const story = new FigureStory(
    view.host,
    (state) => stages.push(state),
    buttons,
    states,
    () => {},
    { finalBand: 0.5 },
  );
  story.measure(56);
  for (const [index, button] of buttons.entries()) {
    button.click();
    story.update();
    assert.equal(stages.at(-1), states[index]);
  }
  view.scroll(0, story);
  assert.equal(stages.at(-1), 'overview');
  view.reduce(story);
  assert(view.classes.has('is-static'));
  assert(!view.styles.has('--story-height'));
});

test('sample bands retain a 14px boundary buffer in both directions', () => {
  const view = scene(),
    stages = [];
  const story = new SampleStory(
    view.host,
    [0, 1, 2],
    (state) => stages.push(state),
    () => {},
    { band: () => 200 },
  );
  story.measure(56);
  const start = 1000 - Number.parseFloat(view.styles.get('--pin-top'));
  view.scroll(start + 190, story);
  view.scroll(start + 205, story);
  assert.deepEqual(stages, [0]);
  view.scroll(start + 215, story);
  assert.deepEqual(stages, [0, 1]);
  view.scroll(start + 195, story);
  assert.deepEqual(stages, [0, 1]);
  view.scroll(start + 185, story);
  assert.deepEqual(stages, [0, 1, 0]);
});

test('inspection and media holds resume only after a new scroll', () => {
  const view = scene(),
    stages = [];
  let playing = false,
    cancellations = 0;
  const story = new SampleStory(
    view.host,
    [0, 1, 2],
    (state) => stages.push(state),
    () => {},
    {
      band: () => 200,
      hold: () => playing || view.dialog.open,
      cancelPending: () => cancellations++,
    },
  );
  story.measure(56);
  story.select(0);
  playing = true;
  story.holdUntilScroll({ cancelPending: true });
  const stoppedAt = scrollY + 450;
  view.scroll(stoppedAt, story);
  playing = false;
  story.update();
  assert.deepEqual(stages, [0]);
  view.scroll(stoppedAt + 1, story);
  assert.equal(stages.at(-1), 2);
  view.dialog.open = true;
  view.scroll(0, story);
  view.dialog.open = false;
  story.update();
  assert.equal(stages.at(-1), 2);
  view.scroll(1, story);
  assert.equal(stages.at(-1), 0);
  assert.equal(cancellations, 1);
});

test('new content positions and viewport sizes refresh control destinations', () => {
  const view = scene(),
    story = new SampleStory(
      view.host,
      [0, 1],
      () => {},
      () => {},
      { band: () => 200 },
    );
  story.measure(56);
  story.select(1);
  const original = scrollY;
  view.move(1250, story);
  story.select(1);
  assert.equal(scrollY, original + 250);
  view.resize(900, story);
  story.select(1);
  assert.equal(scrollY, original + 200);
});

test('small or overflowing frames retain native document flow and direct selection', () => {
  for (const options of [{ width: 900 }, { height: 600 }, { frameHeight: 720 }]) {
    const view = scene(options),
      stages = [],
      story = new SampleStory(
        view.host,
        [0, 1],
        (state) => stages.push(state),
        () => {},
      );
    story.measure(56);
    assert(view.classes.has('is-static'));
    assert(!view.styles.has('--story-height'));
    story.select(1);
    assert.deepEqual(stages, [1]);
    assert.equal(scrollY, 0);
  }
});

test('scroll-only updates do not remeasure layout, and sticky bounds include the track ending', () => {
  const view = scene(),
    story = new SampleStory(
      view.host,
      [0, 1, 2],
      () => {},
      () => {},
      { band: () => 200 },
    );
  story.measure(56);
  const reads = view.reads;
  for (let y = 0; y <= 2000; y += 10) view.scroll(y, story);
  assert.equal(view.reads, reads);
  const bounds = story.frameBounds();
  assert.deepEqual(bounds, { top: -400, bottom: 100 });
});
