import { playIcon, pauseIcon, formatTime } from './render.js';

let activeAudio = null;
export const playingAudio = () => (activeAudio && !activeAudio.paused ? activeAudio : null);
export function pauseAudio() {
  activeAudio?.pause();
  activeAudio = null;
}

export function initializeAudio(host, { onPlay, announce, clearAnnouncement }) {
  for (const player of host.querySelectorAll('.audio-player')) {
    const audio = player.querySelector('audio');
    const button = player.querySelector('.audio-play');
    const seek = player.querySelector('.audio-seek');
    const time = player.querySelector('.audio-time');
    const failureKey = `audio:${player.dataset.label}`;
    const update = () => {
      const loadedDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const duration = loadedDuration || Number(player.dataset.duration);
      seek.disabled = !loadedDuration;
      seek.value = duration ? String((audio.currentTime / duration) * 1000) : '0';
      seek.setAttribute(
        'aria-valuetext',
        `${formatTime(audio.currentTime)} of ${formatTime(duration)}`,
      );
      const failed = player.classList.contains('has-error');
      const loading = !audio.paused && audio.readyState < 3 && !failed;
      player.classList.toggle('is-loading', loading);
      time.textContent = failed
        ? 'Unable to play. Retry.'
        : loading
          ? 'Loading…'
          : duration
            ? `${formatTime(audio.currentTime)} / ${formatTime(duration)}`
            : '0:00';
    };
    const fail = () => {
      if (!audio.isConnected) return;
      const owned = activeAudio === audio;
      player.classList.add('has-error');
      if (owned) pauseAudio();
      update();
      if (owned && !player.closest('[inert]'))
        announce(`Unable to play ${player.dataset.label}.`, failureKey);
    };
    button.addEventListener('click', async () => {
      if (!audio.paused) {
        audio.pause();
        return;
      }
      pauseAudio();
      activeAudio = audio;
      if (player.classList.contains('has-error')) audio.load();
      try {
        await audio.play();
      } catch (error) {
        if (error.name !== 'AbortError' && audio.isConnected && activeAudio === audio) {
          fail();
        }
      }
    });
    audio.addEventListener('play', () => {
      if (player.closest('[inert]')) {
        audio.pause();
        return;
      }
      if (activeAudio !== audio) activeAudio?.pause();
      activeAudio = audio;
      onPlay(player);
      player.classList.remove('has-error');
      button.innerHTML = pauseIcon;
      button.setAttribute('aria-label', `Pause ${player.dataset.label}`);
      update();
    });
    audio.addEventListener('pause', () => {
      if (activeAudio === audio) activeAudio = null;
      button.innerHTML = playIcon;
      button.setAttribute('aria-label', `Play ${player.dataset.label}`);
      update();
    });
    audio.addEventListener('loadedmetadata', update);
    audio.addEventListener('error', fail);
    audio.addEventListener('waiting', update);
    audio.addEventListener('playing', () => {
      update();
      if (audio.isConnected && activeAudio === audio) clearAnnouncement(failureKey);
    });
    audio.addEventListener('timeupdate', update);
    audio.addEventListener('ended', update);
    seek.addEventListener('input', () => {
      if (Number.isFinite(audio.duration))
        audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
      update();
    });
  }
}
