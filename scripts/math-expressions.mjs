// Editable TeX source for the paper's notation. Compiled into outline SVG;
// no MathJax JavaScript or external fonts are shipped to the browser.
export const expressions = {
  marginal: [String.raw`Q_{\mathcal{E}}`, 'Q subscript calligraphic E'],
  conditional: [
    String.raw`Q_{\mathcal{E}}(\cdot\mid x^{\mathcal{S}})`,
    'Conditional latent distribution given the observed subset',
  ],
  point: [
    String.raw`\delta_{\mathcal{E}(x^{\mathcal{M}})}`,
    'Point mass at the full-observation encoding',
  ],
  none: [String.raw`\mathcal{S}=\varnothing`, 'No observed modalities'],
  partial: [
    String.raw`\varnothing\subsetneq\mathcal{S}\subsetneq\mathcal{M}`,
    'A nonempty proper subset of modalities',
  ],
  full: [String.raw`\mathcal{S}=\mathcal{M}`, 'All modalities observed'],
  empty: [String.raw`\varnothing`, 'Empty set'],
  space: [String.raw`\mathcal{W}`, 'Latent space W'],
  sample: ['w', 'One latent sample w'],
  otherInputs: [String.raw`x^{\mathcal{S}\setminus\{m\}}`, 'Observed inputs excluding modality m'],
  target: ['x^m', 'Target modality m'],
  query: [String.raw`\epsilon,0`, 'Gaussian query at time zero'],
  membership: [String.raw`m\in\mathcal{S}`, 'When the target is included among the inputs'],
  inference: [String.raw`\mathcal{E}_{\theta}`, 'Shared inference network E theta'],
  decoder: [String.raw`\mathcal{D}_{\psi_m}`, 'Decoder for target modality m'],
  recLoss: [String.raw`\mathcal{L}_{\mathrm{rec}}`, 'Reconstruction loss'],
  richer: [String.raw`x^{\mathcal{A}}`, 'Richer available observations'],
  subset: [String.raw`x^{\mathcal{S}}`, 'Smaller observation subset'],
  gaussian: ['w_0', 'Gaussian initial state w zero'],
  euler: [String.raw`\times N`, 'N integration steps'],
  nested: [String.raw`\mathcal{S}\subsetneq\mathcal{A}`, 'A strictly smaller observation subset'],
  teacherPrediction: [
    String.raw`\mathcal{E}_{\theta}(w_t^{\mathcal{A}},t;x^{\mathcal{A}})`,
    'Teacher clean prediction at the common state and time',
  ],
  studentPrediction: [
    String.raw`\mathcal{E}_{\theta}(w_t^{\mathcal{A}},t;x^{\mathcal{S}})`,
    'Student clean prediction at the common state and time',
  ],
  distLoss: [String.raw`\widetilde{\mathcal{L}}_{\mathrm{dist}}`, 'Self-distillation loss'],
  contrastS: [String.raw`x_i^{\mathcal{S}}`, 'Subset S of example i'],
  contrastC: [String.raw`x_i^{\mathcal{C}}`, 'Complementary subset C of example i'],
  queryS: [String.raw`\epsilon_i^{\mathcal{S}},0`, 'Independent Gaussian query for subset S'],
  queryC: [String.raw`\epsilon_i^{\mathcal{C}},0`, 'Independent Gaussian query for subset C'],
  reprS: [String.raw`r_i^{\mathcal{S}}`, 'Normalized prediction from subset S'],
  reprC: [String.raw`r_i^{\mathcal{C}}`, 'Normalized prediction from complementary subset C'],
  complement: [
    String.raw`\mathcal{C}=\mathcal{A}\setminus\mathcal{S}`,
    'Complement within the available modalities',
  ],
  conLoss: [String.raw`\mathcal{L}_{\mathrm{con}}`, 'Symmetric contrastive loss'],
  commonState: [String.raw`w_t^{\mathcal{A}},t`, 'Common intermediate state and time'],
  vectorField: [
    String.raw`v_\theta(\cdot;x^{\mathcal{A}})`,
    'Richer-conditioned flow vector field',
  ],
  nonempty: [
    String.raw`\mathcal{S},\mathcal{C}\ne\varnothing`,
    'Both complementary subsets are nonempty',
  ],
  unitNorm: [
    String.raw`\lVert r_i^{\mathcal{S}}\rVert_2=\lVert r_i^{\mathcal{C}}\rVert_2=1`,
    'Both representations have unit L2 norm',
  ],
  factorization: [
    String.raw`P_{\mathrm{data}}(\mathrm{d}x^{\mathcal{T}}\mid x^{\mathcal{S}})=\int\!\left[\prod_{m\in\mathcal{T}}P_{\mathrm{data}}(\mathrm{d}x^m\mid W=w)\right]Q_{\mathcal{E}}(\mathrm{d}w\mid x^{\mathcal{S}})`,
    'Equation 2: the conditional joint data distribution equals the product of conditionally independent target decoders integrated over one shared conditional latent distribution',
  ],
  propositionMean: [
    String.raw`\mu_{\mathcal A}=\mathbb E[W\mid W_t,X^{\mathcal A}]`,
    'The exact teacher prediction mu A is the expected complete latent W given the noisy state W t and the richer observations X A',
  ],
  propositionLossDifference: [
    String.raw`\widetilde{\mathcal L}_{\mathrm{CFM}}-\widetilde{\mathcal L}_{\mathrm{dist}}`,
    'Full-target denoising loss minus self-distillation loss',
  ],
  propositionResidual: [
    String.raw`=\mathbb E\!\left[\lVert W-\mu_{\mathcal A}\rVert_2^2\right]`,
    'Equals the expected squared residual uncertainty of the exact teacher',
  ],
  propositionGradient: [
    String.raw`\nabla_\theta\widetilde{\mathcal L}_{\mathrm{CFM}}=\nabla_\theta\widetilde{\mathcal L}_{\mathrm{dist}}`,
    'The two unweighted losses have the same expected gradient through the subset-conditioned student prediction',
  ],
};
