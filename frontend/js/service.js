// РІВЕНЬ 2: Service — стан застосунку і логіка (без роботи з DOM-розміткою)
const Service = {
  sounds: [],
  category: 'all',
  query: '',
  volume: 0.7,
  muted: false,

  async load() {
    const p = new URLSearchParams();
    if (this.category !== 'all') p.set('category', this.category);
    if (this.query) p.set('q', this.query);
    this.sounds = await Api.getSounds(p.toString());
  },

  play(sound, source = 'click') {
    const audio = new Audio(sound.audio_url);
    audio.volume = this.volume;
    audio.muted = this.muted;
    audio.play().catch(() => UI.toast('Не вдалося завантажити аудіо: ' + sound.title, 'error'));
    UI.pulse(sound.id);
    Api.play(sound.id, source)
      .then((updated) => { sound.play_count = updated.play_count; UI.updateCount(sound); UI.loadStats(); })
      .catch(() => {});
  },

  async playRandom() {
    const sound = await Api.random();
    const local = this.sounds.find((s) => s.id === sound.id) || sound;
    this.play(local, 'random_mix');
  },

  byHotkey(code) {
    return this.sounds.find((s) => s.hotkey === code);
  },
};
