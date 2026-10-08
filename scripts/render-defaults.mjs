import { benchmarks } from '../data.js';
import { getInferenceRegime, inferenceCaption } from '../figure-data.js';
import {
  initialSelections,
  benchmarkTableMarkup,
  benchmarkNoteMarkup,
  benchmarkContext,
  polyPanelsMarkup,
  faceChoicesMarkup,
  faceMatrixMarkup,
  faceCaption,
  galleryBandsMarkup,
  featuredGallerySamples,
} from '../render.js';
import { desktopFigureMarkup } from './figures/desktop.mjs';
import { mobileFigureMarkup } from './figures/mobile.mjs';
import { trainingPanelsMarkup } from './figures/training.mjs';
import { inlineMath } from './generated/math.mjs';

function propositionMathMarkup() {
  return `<div class="theory-equation">${inlineMath('propositionMean', 20)}</div><div class="theory-equation theory-residual">${inlineMath('propositionLossDifference', 20)}${inlineMath('propositionResidual', 20)}</div><div class="theory-equation">${inlineMath('propositionGradient', 20)}</div>`;
}

// Generated defaults share data and markup with the interactive page.
export function renderDefaultBlocks() {
  const { benchmark, faceSample, trainingStage, inferenceRegime } = initialSelections;
  const dataset = benchmarks[benchmark];
  if (!dataset) throw new RangeError(`Unknown initial benchmark: ${benchmark}`);
  const inference = getInferenceRegime(inferenceRegime);
  const native = { nativeLinks: true, nativeControls: true };
  return {
    html: {
      'inference-drawing': desktopFigureMarkup() + mobileFigureMarkup(),
      'training-drawing': trainingPanelsMarkup(trainingStage),
      'equation-drawing': inlineMath('factorization', 22, { decorative: true }),
      'proposition-drawing': propositionMathMarkup(),
      'poly-comparison': polyPanelsMarkup(native),
      'face-sample': faceChoicesMarkup(faceSample, { disabled: true }),
      'face-comparison': faceMatrixMarkup(faceSample, native),
      'results-table': benchmarkTableMarkup(benchmark),
      'benchmark-note': benchmarkNoteMarkup(benchmark),
      'gallery-example': galleryBandsMarkup(native),
    },
    text: {
      'regime-title': inference.title,
      'regime-description': inference.description,
      'teaser-caption': inferenceCaption,
      'face-caption': faceCaption(faceSample),
      'result-context': benchmarkContext(benchmark),
    },
    attributes: {
      'inference-drawing': { 'data-active-regime': inferenceRegime },
      'training-drawing': { 'data-active-objective': trainingStage },
      'face-comparison': { 'data-sample': faceSample },
      'benchmark-panel': { 'aria-labelledby': `tab-${benchmark}` },
    },
    defaults: {
      ...initialSelections,
      gallerySamples: featuredGallerySamples,
    },
  };
}
