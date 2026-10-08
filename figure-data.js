export const inferenceCaption =
  'Figure 1. Schematic latent distributions. The displayed outputs form one unconditional sample.';
const inferenceRegimes = Object.freeze({
  '0': {
    title: 'Marginal latent inference',
    description:
      'With no modalities observed, the flow transports Gaussian noise to the marginal distribution of full-observation latents.',
  },
  '1': {
    title: 'Conditional latent inference',
    description:
      'Given the observed modalities, the flow samples the full-observation latent from its conditional distribution.',
  },
  '2': {
    title: 'Full-observation encoding',
    description:
      'With every modality observed, the latent distribution collapses to a point at the deterministic encoding.',
  },
  overview: {
    title: 'Latent inference and decoding',
    description:
      'Marginal sampling, conditional inference and full-observation encoding use the same latent space and model.',
  },
  decoding: {
    title: 'Decoding',
    description:
      'Target decoders share one latent sample w and generate their outputs independently given w.',
  },
});

/** Pure shared copy for the interactive figure and the static HTML build. */
export function getInferenceRegime(mode) {
  if (!Object.hasOwn(inferenceRegimes, mode))
    throw new RangeError('Unknown inference regime. Expected overview, decoding, 0, 1, or 2.');
  return inferenceRegimes[mode];
}

export const trainingObjectives = Object.freeze([
  {
    title: 'Reconstruction',
    caption:
      "Decoders reconstruct observed modalities from the predicted latent. Stopping reconstruction gradients through a target's own input discourages copying modality-private information.",
  },
  {
    title: 'Self-distillation',
    caption:
      'Predictions conditioned on more modalities supervise the same network conditioned on fewer. This trains conditional latent inference from incomplete examples.',
  },
  {
    title: 'Contrastive alignment',
    caption:
      'A contrastive loss aligns latent predictions from complementary subsets of the same example, using other batch examples as negatives.',
  },
]);
