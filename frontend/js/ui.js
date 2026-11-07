// РІВЕНЬ 3: UI — відображення і події користувача
const CATEGORIES = { memes: 'Меми', games: 'Ігри', reactions: 'Реакції', anime: 'Аніме', cinema: 'Кіно' };
const COLORS = ['primary', 'secondary', 'accent', 'warning', 'error', 'info'];

const UI = {
  $: (s) => document.querySelector(s),
  editId: null,
  hotkey: null,
  capturing: false,

  esc: (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  keyName: (code) => (code ? code.replace(/^(Key|Digit)/, '') : ''),

  toast(msg, type = 'info') {
    const d = document.createElement('div');
    d.className = `alert alert-${type}`;
    d.textContent = msg;
    this.$('#toasts').append(d);
    setTimeout(() => d.remove(), 3000);
  },

  renderTabs() {
    const tabs = { all: 'Всі', ...CATEGORIES };
    this.$('#tabs').innerHTML = Object.entries(tabs).map(([k, v]) =>
      `<a role="tab" data-cat="${k}" class="tab ${Service.category === k ? 'tab-active' : ''}">${v}</a>`).join('');
  },

  render() {
    this.$('#grid').innerHTML = Service.sounds.map((s) => `
      <div class="relative">
        <button data-play="${s.id}" id="b${s.id}" class="btn btn-${s.color} w-full h-28 flex-col normal-case">
          <i data-lucide="volume-2"></i>
          <span class="font-bold">${this.esc(s.title)}</span>
          <span class="text-xs">▶ <b id="c${s.id}">${s.play_count}</b></span>
          ${s.hotkey ? `<kbd class="kbd kbd-xs text-black">${this.keyName(s.hotkey)}</kbd>` : ''}
        </button>
        <div class="absolute top-1 right-1 flex">
          <button data-fav="${s.id}" class="btn btn-ghost btn-xs btn-circle"><i data-lucide="star" class="${s.is_favorite ? 'fill-yellow-300' : ''}"></i></button>
          <button data-edit="${s.id}" class="btn btn-ghost btn-xs btn-circle"><i data-lucide="pencil"></i></button>
          <button data-del="${s.id}" class="btn btn-ghost btn-xs btn-circle"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`).join('') || '<p class="col-span-full text-center opacity-60">Нічого не знайдено</p>';
    lucide.createIcons();
  },

  pulse(id) {
    const b = this.$('#b' + id);
    if (!b) return;
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  },

  updateCount(s) {
    const el = this.$('#c' + s.id);
    if (el) el.textContent = s.play_count;
  },

  async loadStats() {
    try {
      const st = await Api.stats();
      const sotd = st.sound_of_the_day;
      this.$('#sotd').textContent = sotd ? `Звук дня: ${sotd.title} (${sotd.plays_today})` : 'Звук дня: —';
      this.$('#sotd').dataset.id = sotd ? sotd.id : '';
      this.$('#stats').textContent =
        `Усього відтворень: ${st.total_plays} · Топ-категорія: ${CATEGORIES[st.top_category] || '—'}`;
    } catch (e) { /* статистика не критична */ }
  },

  async refresh() {
    try { await Service.load(); this.render(); }
    catch (e) { this.toast('Помилка завантаження: ' + e.message, 'error'); }
  },

  openModal(sound) {
    this.editId = sound ? sound.id : null;
    this.hotkey = sound ? sound.hotkey : null;
    this.$('#modal-title').textContent = sound ? 'Редагувати звук' : 'Новий звук';
    this.$('#f-title').value = sound ? sound.title : '';
    this.$('#f-url').value = sound ? sound.audio_url : '';
    this.$('#f-category').value = sound ? sound.category : 'memes';
    this.$('#f-color').value = sound ? sound.color : 'primary';
    this.$('#f-hotkey').textContent = this.hotkey ? 'Клавіша: ' + this.keyName(this.hotkey) : 'Натисни, щоб призначити клавішу';
    this.$('#modal').showModal();
  },

  async save() {
    const body = {
      title: this.$('#f-title').value, audio_url: this.$('#f-url').value,
      category: this.$('#f-category').value, color: this.$('#f-color').value, hotkey: this.hotkey,
    };
    try {
      if (this.editId) await Api.updateSound(this.editId, body);
      else await Api.addSound(body);
      this.$('#modal').close();
      this.toast(this.editId ? 'Звук оновлено' : 'Звук додано', 'success');
      await this.refresh();
    } catch (e) {
      this.toast(e.status === 409 ? 'Ця гаряча клавіша вже зайнята!' : e.message, e.status === 409 ? 'warning' : 'error');
    }
  },

  init() {
    this.$('#f-category').innerHTML = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    this.$('#f-color').innerHTML = COLORS.map((c) => `<option value="${c}">${c}</option>`).join('');

    this.$('#tabs').addEventListener('click', (e) => {
      if (!e.target.dataset.cat) return;
      Service.category = e.target.dataset.cat;
      this.renderTabs();
      this.refresh();
    });

    this.$('#grid').addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      const find = (id) => Service.sounds.find((s) => s.id === id);
      try {
        if (d.play) Service.play(find(d.play), 'click');
        else if (d.fav) { const s = find(d.fav); await Api.updateSound(s.id, { is_favorite: !s.is_favorite }); this.refresh(); }
        else if (d.edit) this.openModal(find(d.edit));
        else if (d.del && confirm('Видалити звук?')) { await Api.deleteSound(d.del); this.toast('Видалено', 'success'); this.refresh(); this.loadStats(); }
      } catch (err) { this.toast(err.message, 'error'); }
    });

    this.$('#search').addEventListener('input', (e) => { Service.query = e.target.value; this.refresh(); });
    this.$('#volume').addEventListener('input', (e) => { Service.volume = +e.target.value; });
    this.$('#mute').addEventListener('click', () => {
      Service.muted = !Service.muted;
      this.$('#mute').innerHTML = `<i data-lucide="${Service.muted ? 'volume-x' : 'volume-2'}"></i>`;
      lucide.createIcons();
    });
    this.$('#random').addEventListener('click', () => Service.playRandom().catch((e) => this.toast(e.message, 'error')));
    this.$('#sotd').addEventListener('click', (e) => {
      const s = Service.sounds.find((x) => x.id === e.target.dataset.id);
      if (s) Service.play(s, 'click');
    });
    this.$('#add').addEventListener('click', () => this.openModal(null));
    this.$('#f-cancel').addEventListener('click', () => this.$('#modal').close());
    this.$('#f-save').addEventListener('click', () => this.save());
    this.$('#f-hotkey').addEventListener('click', () => { this.capturing = true; this.$('#f-hotkey').textContent = 'Натисни клавішу...'; });

    // Глобальні клавіші
    document.addEventListener('keydown', (e) => {
      if (this.capturing) {
        e.preventDefault();
        this.hotkey = e.code;
        this.capturing = false;
        this.$('#f-hotkey').textContent = 'Клавіша: ' + this.keyName(e.code);
        return;
      }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.repeat) return;
      const s = Service.byHotkey(e.code);
      if (s) { e.preventDefault(); Service.play(s, 'hotkey'); }
    });

    this.renderTabs();
    this.refresh();
    this.loadStats();
  },
};

UI.init();
