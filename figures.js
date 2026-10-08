import { getInferenceRegime, trainingObjectives } from './figure-data.js';

// The figures are present in the static HTML. These controllers only emphasize
// an observation regime or objective and update its associated controls.
export function initializeInference(host, preference, initial) {
  let active = null;
  const controller = {
    set(mode, { animate = true } = {}) {
      const key = String(mode);
      const { title, description } = getInferenceRegime(key);
      if (active === key) return;
      active = key;
      host.dataset.activeRegime = key;
      for (const node of host.querySelectorAll('[data-highlight]')) {
        const emphasized = key === 'overview' || node.dataset.highlight === key;
        const readableLabel = key !== 'decoding' && node.classList.contains('regime-label');
        node.style.opacity = emphasized || readableLabel ? '1' : '.45';
      }
      host.classList.remove('is-playing');
      if (animate && !preference.matches) {
        void host.getBoundingClientRect();
        host.classList.add('is-playing');
      }
      document.querySelector('#regime-title').textContent = title;
      document.querySelector('#regime-description').textContent = description;
      for (const button of document.querySelectorAll('[data-regime]')) {
        button.setAttribute('aria-pressed', String(button.dataset.regime === key));
      }
    },
  };
  controller.set(initial);
  return controller;
}

export function initializeTraining(host, preference, initial) {
  let active = null;
  const controller = {
    set(index, { animate = true } = {}) {
      const key = index === 'overview' ? index : Number(index);
      if (key !== 'overview' && !trainingObjectives[key]) return;
      if (active === key) return;
      active = key;
      host.dataset.activeObjective = String(key);
      for (const panel of host.querySelectorAll('.training-panel')) {
        const selected = key !== 'overview' && Number(panel.dataset.objective) === key;
        panel.classList.toggle('is-dimmed', key !== 'overview' && !selected);
        panel.classList.remove('is-playing');
        if (selected && animate && !preference.matches) {
          void panel.getBoundingClientRect();
          panel.classList.add('is-playing');
        }
        panel.querySelector('[data-training]').setAttribute('aria-pressed', String(selected));
      }
    },
  };
  controller.set(initial, { animate: false });
  return controller;
}
