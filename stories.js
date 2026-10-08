const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));

// Layout is measured only after a viewport/content change. Scroll updates use
// the resulting document coordinates, shared by direct controls and scroll.
class PinnedStory {
  constructor(host, states, setState, { minHeight = 640, band, units = states.length } = {}) {
    this.host = host;
    this.frame = host.querySelector('.story-frame');
    this.states = states;
    this.setState = setState;
    this.pinQuery = matchMedia(
      `(min-width: 960px) and (min-height: ${minHeight}px) and (prefers-reduced-motion: no-preference)`,
    );
    this.getBand = band;
    this.units = units;
    this.pinned = false;
  }
  measure(navHeight) {
    const eligible = this.pinQuery.matches;
    // Measure the compact candidate layout before deciding whether it fits.
    this.host.classList.toggle('is-pinned', eligible);
    this.host.classList.toggle('is-static', !eligible);
    this.frameHeight = this.frame.getBoundingClientRect().height;
    this.pinned = eligible && this.frameHeight <= innerHeight - navHeight - 48;
    this.host.classList.toggle('is-pinned', this.pinned);
    this.host.classList.toggle('is-static', !this.pinned);
    this.layout?.(this.pinned);
    if (this.pinned) {
      this.pinTop = Math.round(
        Math.max(navHeight + 24, (innerHeight - this.frameHeight + navHeight) / 2),
      );
      this.band = this.getBand();
      this.track = this.band * this.units;
      this.host.style.setProperty('--pin-top', `${this.pinTop}px`);
      this.host.style.setProperty('--story-height', `${this.frameHeight + this.track}px`);
    } else {
      this.host.style.removeProperty('--story-height');
    }
    this.documentTop = this.host.getBoundingClientRect().top + scrollY;
  }
  scrollToOffset(offset) {
    scrollTo({ top: this.documentTop - this.pinTop + offset, behavior: 'auto' });
  }
  frameBounds() {
    const top = this.pinned
      ? clamp(scrollY + this.pinTop, this.documentTop, this.documentTop + this.track)
      : this.documentTop;
    return { top: top - scrollY, bottom: top - scrollY + this.frameHeight };
  }
}

export class FigureStory extends PinnedStory {
  constructor(host, setState, controls, states, schedule, { finalBand = 1, minHeight = 640 } = {}) {
    super(host, states, setState, {
      minHeight,
      units: states.length - 1 + finalBand,
      band: () => clamp(innerHeight * 0.32, 180, 300),
    });
    this.phase = -1;
    this.lastY = scrollY;
    for (const button of controls)
      button.addEventListener('click', () => {
        const key = button.dataset.regime ?? button.dataset.training;
        this.setState(key);
        if (this.pinned) {
          const index = this.states.findIndex((state) => String(state) === String(key));
          const center = index + (index === this.states.length - 1 ? finalBand / 2 : 0.5);
          this.scrollToOffset(this.band * center);
        }
        schedule();
      });
  }
  update() {
    if (!this.pinned) {
      if (this.phase !== -1) this.setState('overview', { animate: false });
      this.phase = -1;
      return;
    }
    const units = (scrollY + this.pinTop - this.documentTop) / this.band;
    const phase =
      units < 0
        ? -1
        : Math.min(this.states.length - 1, Math.floor(clamp(units / this.units) * this.units));
    if (phase === this.phase) return;
    this.phase = phase;
    const movingForward = scrollY >= this.lastY;
    this.lastY = scrollY;
    this.setState(phase < 0 ? 'overview' : this.states[phase], {
      animate:
        movingForward &&
        phase >= 0 &&
        this.documentTop + this.frameHeight + this.track - scrollY > 80,
    });
  }
}

export class SampleStory extends PinnedStory {
  constructor(
    host,
    states,
    setState,
    schedule,
    {
      layout = () => {},
      hold = () => false,
      cancelPending = () => {},
      progress = () => {},
      band = () => Math.round(clamp(innerHeight * 0.28, 180, 260)),
    } = {},
  ) {
    super(host, states, setState, { band });
    this.schedule = schedule;
    this.layout = layout;
    this.hold = hold;
    this.cancelPending = cancelPending;
    this.progress = progress;
    this.phase = null;
    this.holdY = null;
  }
  invalidate() {
    this.phase = null;
  }
  retain(index) {
    this.phase = index;
    this.holdUntilScroll();
  }
  holdUntilScroll({ cancelPending = false } = {}) {
    this.holdY = scrollY;
    if (cancelPending) {
      this.cancelPending();
      this.invalidate();
    }
  }
  selectionOffset() {
    return this.band / 2;
  }
  select(state) {
    const index = this.states.indexOf(state);
    if (index < 0) return;
    this.holdY = null;
    this.phase = index;
    this.setState(state, { announceSelection: true });
    if (this.pinned) this.scrollToOffset(this.band * index + this.selectionOffset());
    this.schedule();
  }
  update() {
    if (!this.pinned) {
      this.invalidate();
      return;
    }
    const units = (scrollY + this.pinTop - this.documentTop) / this.band;
    if (this.hold()) {
      this.holdUntilScroll();
      return;
    }
    if (this.holdY !== null) {
      if (scrollY === this.holdY) return;
      this.holdY = null;
    }
    let phase = clamp(Math.floor(units), 0, this.states.length - 1);
    if (this.phase !== null && Math.abs(phase - this.phase) === 1) {
      if (phase > this.phase && units < phase + 14 / this.band) phase = this.phase;
      else if (phase < this.phase && units > this.phase - 14 / this.band) phase = this.phase;
    }
    this.progress(this.states[phase], clamp(units - phase));
    if (phase === this.phase) return;
    this.phase = phase;
    this.setState(this.states[phase]);
  }
}
