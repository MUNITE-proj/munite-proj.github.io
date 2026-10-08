// Index order matches benchmarks.{poly,ffhq,ita}.metrics in data.js.
// Definitions: MUNITE_submission.pdf, Table 2 (p. 9), D.4 (p. 19), E.1–E.3 (pp. 20–21).
export const metricNotes = {
  poly: [
    'Fréchet distance uses frozen verifier features to compare generated and real digit-view distributions; distances are averaged over three views, with lower values indicating greater fidelity.',
    'Without observations, coherence is the fraction of samples whose three generated views all receive the generated digit label from frozen verifiers.',
    'Without observations, coherence is the fraction of samples whose three generated views all receive the generated quadrant label from frozen verifiers.',
    'Given a digit label, accuracy is the fraction of generated views that a frozen verifier classifies as that input digit.',
    'Given a quadrant label, accuracy is the fraction of generated views that a frozen verifier assigns to that input quadrant.',
    'Given digit and quadrant labels, a generated view counts as correct only when frozen verifiers match both input labels.',
    'With digit observed, quadrant coherence averages frozen verifier agreement on the unobserved quadrant over the three generated view pairs and all samples.',
    'With quadrant observed, digit coherence averages frozen verifier agreement on the unobserved digit over the three generated view pairs and all samples.',
  ],
  ffhq: [
    'Fréchet Inception Distance compares generated and real RGB face distributions using Inception V3 features; lower values indicate greater fidelity.',
    'Without observations, age coherence measures how often a frozen verifier’s age-bin prediction for the generated face matches its generated age label.',
    'Without observations, gender coherence measures how often a frozen verifier’s prediction for the generated face matches its generated gender label.',
    'Without observations, segmentation coherence is 19-class pixel accuracy between the generated segmentation map and a frozen verifier’s prediction for the generated RGB face.',
    'Without observations, normal error is one minus mean per-pixel cosine similarity between generated normals and a frozen verifier’s prediction for the generated RGB face.',
    'Given an age label, accuracy measures how often a frozen verifier assigns the generated RGB face to that input age bin.',
    'Given a gender label, accuracy measures how often a frozen verifier’s prediction for the generated RGB face matches that input label.',
    'Given age and gender labels, a generated RGB face counts as correct only when both frozen verifier predictions match their respective inputs.',
    'Given age and gender, segmentation coherence is 19-class pixel accuracy between generated segmentation and a frozen verifier’s prediction for the jointly generated RGB face.',
    'Given age and gender, normal error is one minus mean per-pixel cosine similarity between generated normals and frozen verifier predictions for the jointly generated RGB face.',
  ],
  ita: [
    'With text observed, AIS measures how highly each generated image ranks its paired generated audio within the generated-audio reference pool. Scores are multiplied by 100.',
    'With image observed, CLAP measures text–audio embedding similarity between the jointly generated caption and audio. Scores are multiplied by 100.',
    'With audio observed, CLIP measures text–image embedding similarity between the jointly generated caption and image. Scores are multiplied by 100.',
    'Without observations, CLIP measures text–image embedding similarity between jointly generated captions and images. Scores are multiplied by 100.',
    'Without observations, CLAP measures text–audio embedding similarity between jointly generated captions and audio. Scores are multiplied by 100.',
    'Without observations, AIS measures how highly each generated image ranks its paired generated audio within the generated-audio reference pool. Scores are multiplied by 100.',
  ],
};
