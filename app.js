import { benchmarks, gallery } from './data.js';
import { initializeInference, initializeTraining } from './figures.js';
import { FigureStory, SampleStory } from './stories.js';
import { initializeAudio, pauseAudio, playingAudio } from './audio.js';
import {
  initialSelections,
  benchmarkTableMarkup,
  polyPanelsMarkup,
  faceMatrixMarkup,
  faceSampleLabels,
  faceCaption,
  gallerySourceCaption,
  galleryBandsMarkup,
  featuredGallerySamples,
  benchmarkContext,
  benchmarkNoteMarkup,
} from './render.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const dialog = $('.image-dialog');
let imageOpener = null;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let announcementKey = null;
function announce(message, key = null) {
  announcementKey = key;
  $('#interaction-status').textContent = message;
}
function clearAnnouncement(key) {
  if (announcementKey === key) announce('');
}
function replacePresentation(host, markup) {
  const active = document.activeElement;
  const focused = host.contains(active);
  const route = focused ? active.closest('[data-gallery-route]')?.dataset.galleryRoute : null;
  const image = focused
    ? active.closest('.image-zoom')?.querySelector('img')?.getAttribute('src')
    : null;
  const audio = focused && active.tagName === 'AUDIO';
  host.innerHTML = markup;
  if (!focused) return;
  const scope = route ? host.querySelector(`[data-gallery-route="${route}"]`) : host;
  const next = audio
    ? scope?.querySelector('.audio-play')
    : [...(scope?.querySelectorAll('.image-zoom') || [])].find(
        (button) => button.querySelector('img')?.getAttribute('src') === image,
      );
  next?.focus({ preventScroll: true });
}
const inference = initializeInference(
  $('#inference-drawing'),
  motionPreference,
  initialSelections.inferenceRegime,
);
const training = initializeTraining(
  $('#training-drawing'),
  motionPreference,
  initialSelections.trainingStage,
);

const stories = [
  new FigureStory(
    $('#inference-story'),
    (state, options) => inference.set(state, options),
    $$('[data-regime]'),
    ['0', '1', '2', 'decoding'],
    scheduleFigureScroll,
    { minHeight: 720 },
  ),
  // A brief final overview makes joint training explicit without another full hold.
  new FigureStory(
    $('#training-story'),
    (state, options) => training.set(state, options),
    $$('[data-training]'),
    ['0', '1', '2', 'overview'],
    scheduleFigureScroll,
    { finalBand: 0.5 },
  ),
];

// Native MathML preserves the expression for assistive technology. An extra
// keyboard stop is useful only on screens where the expression overflows.
const equationViewport = $('.equation-viewport');
function updateEquationOverflow() {
  const overflows = equationViewport.scrollWidth > equationViewport.clientWidth + 1;
  $('#equation-scroll-hint').hidden = !overflows;
  if (overflows) equationViewport.tabIndex = 0;
  else equationViewport.removeAttribute('tabindex');
}
new ResizeObserver(updateEquationOverflow).observe(equationViewport);
document.fonts.ready.then(() => {
  updateEquationOverflow();
  scheduleFigureLayout();
});
updateEquationOverflow();

// Only scroll/resize/content changes schedule work; there is no idle loop.
let scrollFrame = 0,
  layoutDirty = true,
  navHeight = 0;
let sectionPositions = [],
  routePositions = [];
function scheduleFigureScroll() {
  if (!scrollFrame)
    scrollFrame = requestAnimationFrame(() => {
      updateReadingContext();
      scrollFrame = 0;
    });
}
addEventListener('scroll', scheduleFigureScroll, { passive: true });
function scheduleFigureLayout() {
  layoutDirty = true;
  scheduleFigureScroll();
}
addEventListener('resize', scheduleFigureLayout, { passive: true });
motionPreference.addEventListener('change', () => {
  if (motionPreference.matches) {
    faceAnimation?.cancel();
    for (const routeKey of galleryStories.keys()) cancelGalleryAnimations(routeKey);
  }
  scheduleFigureLayout();
});
const layoutObserver = new ResizeObserver(scheduleFigureLayout);
layoutObserver.observe(document.body);
scheduleFigureScroll();
// The static fallback lists every gallery example. Once the fitting scroll
// stages mount, restore an initial fragment against their final geometry.
// Delayed mounting and history restoration retain the reader's position.
if (
  document.readyState !== 'complete' &&
  location.hash &&
  performance.getEntriesByType('navigation')[0]?.type !== 'back_forward'
) {
  const fragment = location.hash;
  const restoration = new AbortController();
  for (const type of ['wheel', 'touchstart', 'keydown'])
    addEventListener(type, () => restoration.abort(), {
      once: true,
      passive: true,
      signal: restoration.signal,
    });
  addEventListener(
    'pageshow',
    () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!restoration.signal.aborted && location.hash === fragment)
            document
              .getElementById(decodeURIComponent(fragment.slice(1)))
              ?.scrollIntoView({ block: 'start', behavior: 'auto' });
          restoration.abort();
        }),
      ),
    { once: true, signal: restoration.signal },
  );
}
function updateReadingContext() {
  if (layoutDirty) {
    layoutDirty = false;
    navHeight = $('.section-nav').getBoundingClientRect().height;
    for (const story of stories) story.measure(navHeight);
    applyFaceWipe();
    sectionPositions = $$('[data-section]').map((link) => ({
      link,
      top: $(`#${link.dataset.section}`).getBoundingClientRect().top + scrollY,
    }));
    routePositions = $$('[data-gallery-jump]').map((link) => ({
      link,
      top: $(`#sample-${link.dataset.galleryJump}`).getBoundingClientRect().top + scrollY,
    }));
  }
  const threshold = scrollY + Math.max(120, Math.min(220, innerHeight * 0.25));
  for (const positions of [sectionPositions, routePositions]) {
    const current = positions.filter((item) => item.top <= threshold).at(-1)?.link;
    for (const { link } of positions) {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  for (const story of stories) story.update();
}

replacePresentation($('#poly-comparison'), polyPanelsMarkup());

// Reveal only the connecting stems, once all three reported rows are in view.
// Existing anchors/restored positions retain their already visible evidence.
function initializeCoherenceReveal() {
  if (
    motionPreference.matches ||
    performance.getEntriesByType('navigation')[0]?.type === 'back_forward'
  )
    return;
  const pendingCharts = new Set(
    $$('.poly-coherence .score-chart').filter((chart) => {
      const rect = chart.getBoundingClientRect();
      return rect.top >= innerHeight && rect.height <= innerHeight - 112;
    }),
  );
  if (pendingCharts.size) {
    const finishChart = (chart, animate) => {
      if (!pendingCharts.has(chart)) return;
      if (animate) chart.classList.add('is-revealed');
      chart.classList.remove('will-reveal');
      coherenceObserver.unobserve(chart);
      pendingCharts.delete(chart);
    };
    const coherenceObserver = new IntersectionObserver(
      (entries) => {
        releaseUnavailableCharts();
        for (const entry of entries)
          if (entry.isIntersecting && entry.intersectionRatio >= 0.99)
            finishChart(entry.target, !motionPreference.matches);
      },
      { threshold: 0.99, rootMargin: '0px 0px -32px 0px' },
    );
    for (const chart of pendingCharts) {
      chart.classList.add('will-reveal');
      coherenceObserver.observe(chart);
    }
    const releaseUnavailableCharts = () => {
      if (!pendingCharts.size) return;
      const navBottom = $('.section-nav').getBoundingClientRect().bottom;
      for (const chart of pendingCharts) {
        const rect = chart.getBoundingClientRect();
        if (motionPreference.matches || rect.height > innerHeight - 112 || rect.top < navBottom)
          finishChart(chart, false);
      }
    };
    addEventListener('scroll', releaseUnavailableCharts, { passive: true });
    addEventListener('resize', releaseUnavailableCharts, { passive: true });
    motionPreference.addEventListener('change', releaseUnavailableCharts);
  }
}
// Fragment scrolling and history restoration follow the initial page load.
// Preparing after pageshow keeps evidence visible at the arriving position.
const scheduleCoherenceReveal = () => requestAnimationFrame(initializeCoherenceReveal);
if (document.readyState === 'complete') scheduleCoherenceReveal();
else addEventListener('pageshow', scheduleCoherenceReveal, { once: true });

const faceLoadMessage = $('#face-load-message');
function clearFaceLoadError() {
  faceLoadMessage.hidden = true;
  clearAnnouncement('face-load');
}

let faceRequest = 0,
  faceStory = null,
  faceAnimation = null,
  pendingFace = null,
  faceMounted = false;
let displayedFace = String(initialSelections.faceSample);
const faceWipeRange = $('#face-wipe-range');
let desiredFaceWipe = { row: displayedFace, pair: 0, amount: 0.5 },
  faceWipeDragging = false;
function applyFaceWipe() {
  if (desiredFaceWipe.row !== displayedFace) return;
  const stage = $('#face-comparison');
  const current = stage.lastElementChild;
  const pixels = devicePixelRatio || 1;
  const { pair, amount } = desiredFaceWipe;
  const measurements = [...current.querySelectorAll('.face-wipe')].map((wipe) => ({
    wipe,
    rect: wipe.getBoundingClientRect(),
  }));
  for (const { wipe, rect } of measurements) {
    const edge = Math.round((rect.left + amount * rect.width) * pixels) / pixels;
    const divider = amount === 0 ? 0 : amount === 1 ? 1 : clamp((edge - rect.left) / rect.width);
    wipe.style.setProperty('--face-seg', `${(pair === 0 ? divider : 1) * 100}%`);
    wipe.style.setProperty('--face-normal', `${(pair === 1 ? divider : 0) * 100}%`);
    wipe.style.setProperty('--face-divider', `${divider * 100}%`);
    wipe.style.setProperty(
      '--face-divider-opacity',
      divider > 0.005 && divider < 0.995 ? '1' : '0',
    );
  }
  faceWipeRange.value = String(Math.round(amount * 100));
  const name = pair === 0 ? 'Segmentation over RGB' : 'Surface normals over segmentation';
  faceWipeRange.setAttribute('aria-valuetext', `${name}, ${faceWipeRange.value}%`);
  current.querySelectorAll('.face-wipe-heading').forEach((e) => {
    e.textContent = pair === 0 ? 'Seg. | RGB' : 'Normals | Seg.';
  });
  $$('[data-face-pair]').forEach((button) =>
    button.setAttribute('aria-pressed', String(Number(button.dataset.facePair) === pair)),
  );
}
const faceWipeHold = 20;
const faceScrollOffset = (band, pair, amount) =>
  faceWipeHold + ((band - 2 * faceWipeHold) * (pair + amount)) / 2;
function requestFaceWipe(row, progress) {
  const margin = faceWipeHold / faceStory.band;
  const position = 2 * clamp((progress - margin) / (1 - 2 * margin));
  desiredFaceWipe = {
    row: String(row),
    pair: position < 1 ? 0 : 1,
    amount: position < 1 ? position : position - 1,
  };
  applyFaceWipe();
}
async function renderFaces(row, { animate = true, force = false, announceSelection = false } = {}) {
  row = String(row);
  if (!force && row === displayedFace && faceMounted) {
    ++faceRequest;
    pendingFace = null;
    clearFaceLoadError();
    return;
  }
  if (!force && row === pendingFace) return;
  const request = ++faceRequest;
  pendingFace = row;
  clearFaceLoadError();
  const container = document.createElement('div');
  container.innerHTML = faceMatrixMarkup(row);
  const matrix = container.firstElementChild;
  try {
    // Original cells and overlay layers are decoded and committed together.
    await Promise.all(
      [...matrix.querySelectorAll('img')].map((image) => {
        image.loading = 'eager';
        return image.decode();
      }),
    );
  } catch {
    if (request === faceRequest) {
      pendingFace = null;
      faceLoadMessage.textContent =
        'The requested example could not be loaded. Select a label to retry.';
      faceLoadMessage.hidden = false;
      announce('This FFHQ64 sample could not be loaded.', 'face-load');
    }
    return;
  }
  if (request !== faceRequest) return;
  if (dialog.open) {
    pendingFace = null;
    faceStory?.invalidate();
    return;
  }
  const stage = $('#face-comparison');
  faceAnimation?.cancel();
  const previous = stage.lastElementChild;
  const focused = previous?.contains(document.activeElement) ? document.activeElement : null;
  [...stage.children].filter((layer) => layer !== previous).forEach((layer) => layer.remove());
  // Each overlay owns its clip positions, so the outgoing sample retains them.
  stage.append(matrix);
  if (focused)
    matrix
      .querySelector(
        `[data-model="${focused.dataset.model}"][data-modality="${focused.dataset.modality}"]`,
      )
      ?.focus({ preventScroll: true });
  if (previous) {
    previous.inert = true;
    previous.setAttribute('aria-hidden', 'true');
  }
  stage.dataset.sample = row;
  displayedFace = row;
  pendingFace = null;
  faceMounted = true;
  applyFaceWipe();
  $('#face-caption').textContent = faceCaption(row);
  $$('[data-face]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.face === row)),
  );
  if (announceSelection)
    announce(`Sample ${Number(row) + 1} of 8. Observed ${faceSampleLabels[row]}.`);
  if (animate && !motionPreference.matches && previous) {
    faceAnimation = matrix.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      easing: 'ease-out',
    });
    const animation = faceAnimation;
    animation.finished
      .catch(() => {})
      .then(() => {
        previous.remove();
        if (faceAnimation === animation) faceAnimation = null;
      });
  } else previous?.remove();
  scheduleFigureScroll();
}

class FaceStory extends SampleStory {
  constructor(host) {
    super(host, Object.keys(faceSampleLabels), renderFaces, scheduleFigureScroll, {
      cancelPending: () => {
        ++faceRequest;
        pendingFace = null;
      },
      hold: () => faceWipeDragging || dialog.open,
      progress: requestFaceWipe,
      band: () =>
        Math.round(
          2 * host.querySelector('.face-wipe').getBoundingClientRect().width + 2 * faceWipeHold,
        ),
    });
    $$('[data-face]').forEach((button) =>
      button.addEventListener('click', () => this.select(button.dataset.face)),
    );
    const preloadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        for (const row of Object.keys(faceSampleLabels))
          for (const model of ['muni', 'munite'])
            for (const modality of ['rgb', 'segmentation', 'normals']) {
              const image = new Image();
              image.src = `./assets/ffhq/sample-${row}-${model}-${modality}.webp`;
              image.decode().catch(() => {});
            }
        preloadObserver.disconnect();
      },
      { rootMargin: `${innerHeight}px` },
    );
    preloadObserver.observe(host);
  }
  selectionOffset() {
    return faceScrollOffset(this.band, 0, 0.5);
  }
  select(state) {
    if (!this.pinned) desiredFaceWipe = { ...desiredFaceWipe, row: String(state) };
    super.select(state);
  }
  syncWipe({ row, pair, amount }) {
    if (this.pinned) {
      this.scrollToOffset(
        this.band * this.states.indexOf(row) + faceScrollOffset(this.band, pair, amount),
      );
    }
    this.holdUntilScroll({ cancelPending: true });
  }
}
faceStory = new FaceStory($('#face-story'));
stories.push(faceStory);
renderFaces(initialSelections.faceSample, { animate: false, force: true });
faceWipeRange.addEventListener('input', () => {
  desiredFaceWipe = {
    row: displayedFace,
    pair: desiredFaceWipe.pair,
    amount: Number(faceWipeRange.value) / 100,
  };
  faceStory.syncWipe(desiredFaceWipe);
  applyFaceWipe();
});
$$('[data-face-pair]').forEach((button) =>
  button.addEventListener('click', () => {
    desiredFaceWipe = { row: displayedFace, pair: Number(button.dataset.facePair), amount: 0.5 };
    faceStory.syncWipe(desiredFaceWipe);
    applyFaceWipe();
  }),
);
faceWipeRange.addEventListener('pointerdown', () => {
  faceWipeDragging = true;
  faceStory.holdUntilScroll({ cancelPending: true });
});
const releaseFaceWipe = () => {
  faceWipeDragging = false;
  scheduleFigureScroll();
};
addEventListener('pointerup', releaseFaceWipe);
addEventListener('pointercancel', releaseFaceWipe);

function activateTab(buttons, selected, panel) {
  buttons.forEach((button) => {
    const active = button === selected;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', selected.id);
}
$$('[role="tablist"]').forEach((tablist) =>
  tablist.addEventListener('keydown', (event) => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')],
      index = tabs.indexOf(event.target);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
  }),
);
function renderBenchmark(key) {
  activateTab($$('[data-benchmark]'), $(`[data-benchmark="${key}"]`), $('#benchmark-panel'));
  $('#result-context').textContent = benchmarkContext(key);
  $('#benchmark-note').innerHTML = benchmarkNoteMarkup(key);
  $('#results-table').innerHTML = benchmarkTableMarkup(key);
  scheduleFigureLayout();
}
$$('[data-benchmark]').forEach((button) =>
  button.addEventListener('click', () => {
    renderBenchmark(button.dataset.benchmark);
    announce(`${benchmarks[button.dataset.benchmark].name} results.`);
  }),
);
renderBenchmark(initialSelections.benchmark);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseAudio();
});

$$('.audio-player-native audio').forEach((audio) => audio.pause());
const currentSamples = { ...featuredGallerySamples },
  galleryStories = new Map(),
  galleryLayouts = new Map(),
  galleryRequests = new Map(),
  galleryAnimations = new Map(),
  seekingRoutes = new Set();
replacePresentation($('#gallery-example'), galleryBandsMarkup());
initializeAudio($('#gallery-example'), {
  onPlay: (player) =>
    galleryStories
      .get(player.closest('[data-gallery-route]').dataset.galleryRoute)
      ?.holdUntilScroll({ cancelPending: true }),
  announce,
  clearAnnouncement,
});

function ownAudio(routeKey) {
  return playingAudio()?.closest('[data-gallery-route]')?.dataset.galleryRoute === routeKey;
}
function setGalleryAvailability(routeKey, pinned) {
  const band = $(`#sample-${routeKey}`);
  band.querySelectorAll('[data-gallery-sample]').forEach((layer) => {
    const inactive = pinned && Number(layer.dataset.gallerySample) !== currentSamples[routeKey];
    layer.inert = inactive;
    if (inactive) layer.setAttribute('aria-hidden', 'true');
    else layer.removeAttribute('aria-hidden');
  });
}
function setGalleryLayout(routeKey, pinned) {
  const changed = galleryLayouts.get(routeKey) !== pinned;
  galleryLayouts.set(routeKey, pinned);
  if (pinned && changed) {
    const band = $(`#sample-${routeKey}`);
    const playing = ownAudio(routeKey) ? playingAudio().closest('[data-gallery-sample]') : null;
    const focused = band.contains(document.activeElement)
      ? document.activeElement.closest('[data-gallery-sample]')
      : null;
    const inspecting =
      dialog.open && band.contains(imageOpener)
        ? imageOpener.closest('[data-gallery-sample]')
        : null;
    const retained = inspecting || focused || playing;
    if (playing && playing !== retained) pauseAudio();
    if (retained) {
      const index = Number(retained.dataset.gallerySample),
        story = galleryStories.get(routeKey);
      commitGallerySample(routeKey, index);
      story.retain(index);
    }
  }
  if (changed) {
    if (!pinned) cancelGalleryAnimations(routeKey);
    setGalleryAvailability(routeKey, pinned);
  }
}
function commitGallerySample(routeKey, index) {
  const band = $(`#sample-${routeKey}`),
    previous = band.querySelector('.gallery-example.is-active'),
    next = band.querySelector(`[data-gallery-sample="${index}"]`);
  const focused = previous?.contains(document.activeElement) ? document.activeElement : null;
  previous?.classList.remove('is-active');
  next.classList.add('is-active');
  currentSamples[routeKey] = index;
  setGalleryAvailability(routeKey, galleryStories.get(routeKey)?.pinned ?? false);
  band.querySelector('.gallery-source').textContent = gallerySourceCaption(routeKey, index);
  band
    .querySelectorAll('[data-sample]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(Number(button.dataset.sample) === index)),
    );
  if (focused) {
    const selector = focused.closest('.image-zoom')
      ? '.image-zoom'
      : focused.classList.contains('audio-seek')
        ? '.audio-seek'
        : '.audio-play';
    const target =
      next.querySelector(`${selector}:not(:disabled)`) || next.querySelector('.audio-play');
    target?.focus({ preventScroll: true });
  }
  return next;
}
function cancelGalleryAnimations(routeKey) {
  galleryAnimations.get(routeKey)?.cancel();
  galleryAnimations.delete(routeKey);
}
async function renderGalleryExample(
  routeKey,
  index,
  { animate = true, announceSelection = false } = {},
) {
  const request = (galleryRequests.get(routeKey) || 0) + 1;
  galleryRequests.set(routeKey, request);
  cancelGalleryAnimations(routeKey);
  const band = $(`#sample-${routeKey}`),
    next = band.querySelector(`[data-gallery-sample="${index}"]`);
  if (index === currentSamples[routeKey]) return;
  try {
    await Promise.all(
      [...next.querySelectorAll('img')].map((image) => {
        image.loading = 'eager';
        return image.decode();
      }),
    );
  } catch {
    if (galleryRequests.get(routeKey) === request)
      announce(
        `Sample A${gallery[routeKey].samples[index].id} could not be loaded. Select it to retry.`,
      );
    return;
  }
  if (galleryRequests.get(routeKey) !== request) return;
  if (dialog.open || (!announceSelection && (ownAudio(routeKey) || seekingRoutes.has(routeKey)))) {
    galleryStories.get(routeKey).invalidate();
    return;
  }
  const previous = band.querySelector('.gallery-example.is-active');
  const shouldAnimate = () =>
    animate && !motionPreference.matches && galleryStories.get(routeKey)?.pinned;
  if (shouldAnimate()) {
    const out = previous.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 90,
      easing: 'ease-in',
      fill: 'forwards',
    });
    galleryAnimations.set(routeKey, out);
    await out.finished.catch(() => {});
    if (galleryRequests.get(routeKey) !== request) return;
  }
  // Media/inspection can start during image decoding or the outgoing fade.
  if (dialog.open || (!announceSelection && (ownAudio(routeKey) || seekingRoutes.has(routeKey)))) {
    cancelGalleryAnimations(routeKey);
    galleryStories.get(routeKey).invalidate();
    return;
  }
  previous.querySelectorAll('audio').forEach((audio) => {
    if (audio === playingAudio()) pauseAudio();
    else audio.pause();
  });
  const layer = commitGallerySample(routeKey, index);
  cancelGalleryAnimations(routeKey);
  if (shouldAnimate()) {
    const incoming = layer.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 150,
      easing: 'ease-out',
    });
    galleryAnimations.set(routeKey, incoming);
    incoming.finished
      .catch(() => {})
      .then(() => {
        if (galleryAnimations.get(routeKey) === incoming) galleryAnimations.delete(routeKey);
      });
  }
  if (announceSelection)
    announce(
      `Sample A${gallery[routeKey].samples[index].id}, ${index + 1} of ${gallery[routeKey].samples.length}.`,
    );
  scheduleFigureScroll();
}

for (const routeKey of Object.keys(gallery)) {
  const band = $(`#sample-${routeKey}`),
    host = band.querySelector('.gallery-story');
  const story = new SampleStory(
    host,
    gallery[routeKey].samples.map((_, i) => i),
    (index, options) => renderGalleryExample(routeKey, index, options),
    scheduleFigureScroll,
    {
      layout: (pinned) => setGalleryLayout(routeKey, pinned),
      cancelPending: () => {
        galleryRequests.set(routeKey, (galleryRequests.get(routeKey) || 0) + 1);
        cancelGalleryAnimations(routeKey);
      },
      hold: () => {
        const frame = galleryStories.get(routeKey).frameBounds();
        const offscreen = frame.bottom <= navHeight || frame.top >= innerHeight;
        if (offscreen && ownAudio(routeKey)) pauseAudio();
        return dialog.open || ownAudio(routeKey) || seekingRoutes.has(routeKey);
      },
    },
  );
  galleryStories.set(routeKey, story);
  stories.push(story);
  const preloadObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      band.querySelectorAll('img').forEach((image) => {
        image.loading = 'eager';
        image.decode().catch(() => {});
      });
      preloadObserver.disconnect();
    },
    { rootMargin: `${innerHeight}px` },
  );
  preloadObserver.observe(host);
}
$('#gallery-example').addEventListener('click', (event) => {
  const button = event.target.closest('[data-sample]');
  if (!button) return;
  const key = button.closest('[data-gallery-route]').dataset.galleryRoute,
    index = Number(button.dataset.sample);
  galleryStories.get(key).select(index);
});
$('#gallery-example').addEventListener('keydown', (event) => {
  const button = event.target.closest('.sample-filmstrip [data-sample]');
  if (!button) return;
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const band = event.target.closest('[data-gallery-route]'),
    key = band.dataset.galleryRoute,
    count = gallery[key].samples.length;
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? count - 1
        : (Number(button.dataset.sample) + (event.key === 'ArrowRight' ? 1 : count - 1)) % count;
  galleryStories.get(key).select(index);
  band.querySelector(`[data-sample="${index}"]`).focus({ preventScroll: true });
});
$('#gallery-example').addEventListener('pointerdown', (event) => {
  if (!event.target.classList.contains('audio-seek')) return;
  const routeKey = event.target.closest('[data-gallery-route]').dataset.galleryRoute;
  seekingRoutes.add(routeKey);
  galleryStories.get(routeKey).holdUntilScroll({ cancelPending: true });
});
const releaseSeek = () => {
  seekingRoutes.clear();
  scheduleFigureScroll();
};
addEventListener('pointerup', releaseSeek);
addEventListener('pointercancel', releaseSeek);

document.addEventListener('click', (event) => {
  const button = event.target.closest('.image-zoom');
  if (!button) return;
  if (button.tagName === 'A') event.preventDefault();
  const image = button.querySelector('img');
  imageOpener = button;
  $('#image-dialog-image').src = image.src;
  $('#image-dialog-image').alt = image.alt;
  $('#image-dialog-caption').textContent = image.alt;
  dialog.showModal();
  stories
    .filter((story) => story instanceof SampleStory)
    .forEach((story) => story.holdUntilScroll({ cancelPending: true }));
  scheduleFigureScroll();
});
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    dialog.close();
});
dialog.addEventListener('close', () => {
  imageOpener?.focus({ preventScroll: true });
  scheduleFigureScroll();
});

// Static HTML keeps its native media and links until all interactive views mount.
$$('[data-js-control]').forEach((control) => {
  control.disabled = false;
});

for (const story of stories) layoutObserver.observe(story.frame);
document.body.classList.add('js-ready');
