const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const SOUNDS = path.join(__dirname, 'data/sounds.json');
const HISTORY = path.join(__dirname, 'data/play_history.json');
const CATEGORIES = ['memes', 'games', 'reactions', 'anime', 'cinema'];
const COLORS = ['primary', 'secondary', 'accent', 'warning', 'error', 'info'];

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));
const validUrl = (u) => typeof u === 'string' && (/^https?:\/\//.test(u) || u.startsWith('/'));
const hotkeyTaken = (sounds, hotkey, exceptId) =>
  hotkey && sounds.some((s) => s.hotkey === hotkey && s.id !== exceptId);

// --- Каталог ---
app.get('/api/sounds', (req, res) => {
  let list = read(SOUNDS);
  const { category, q } = req.query;
  if (category) list = list.filter((s) => s.category === category);
  if (q) list = list.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()));
  res.json(list);
});

// ВАЖЛИВО: /random має бути до /:id
app.post('/api/sounds/random', (req, res) => {
  const list = read(SOUNDS);
  if (!list.length) return res.status(404).json({ error: 'Бібліотека порожня' });
  res.json(list[Math.floor(Math.random() * list.length)]);
});

app.get('/api/sounds/:id', (req, res) => {
  const sound = read(SOUNDS).find((s) => s.id === req.params.id);
  if (!sound) return res.status(404).json({ error: 'Звук не знайдено' });
  res.json(sound);
});

app.post('/api/sounds', (req, res) => {
  const { title, category, audio_url, hotkey = null, color = 'primary' } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Потрібна назва' });
  if (!validUrl(audio_url)) return res.status(400).json({ error: 'Некоректний audio_url' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Некоректна категорія' });
  if (!COLORS.includes(color)) return res.status(400).json({ error: 'Некоректний колір' });
  const sounds = read(SOUNDS);
  if (hotkeyTaken(sounds, hotkey)) return res.status(409).json({ error: 'Ця клавіша вже зайнята' });
  const sound = {
    id: String(Date.now()), title: title.trim(), category, audio_url, hotkey, color,
    play_count: 0, is_favorite: false, created_at: new Date().toISOString(),
  };
  sounds.push(sound);
  write(SOUNDS, sounds);
  res.status(201).json(sound);
});

app.patch('/api/sounds/:id', (req, res) => {
  const sounds = read(SOUNDS);
  const sound = sounds.find((s) => s.id === req.params.id);
  if (!sound) return res.status(404).json({ error: 'Звук не знайдено' });
  if ('hotkey' in req.body && hotkeyTaken(sounds, req.body.hotkey, sound.id))
    return res.status(409).json({ error: 'Ця клавіша вже зайнята' });
  for (const f of ['title', 'category', 'audio_url', 'hotkey', 'color', 'is_favorite']) {
    if (f in req.body) sound[f] = req.body[f];
  }
  write(SOUNDS, sounds);
  res.json(sound);
});

app.delete('/api/sounds/:id', (req, res) => {
  const sounds = read(SOUNDS);
  if (!sounds.some((s) => s.id === req.params.id))
    return res.status(404).json({ error: 'Звук не знайдено' });
  write(SOUNDS, sounds.filter((s) => s.id !== req.params.id));
  write(HISTORY, read(HISTORY).filter((h) => h.sound_id !== req.params.id));
  res.json({ ok: true });
});

// --- Відтворення та статистика ---
app.post('/api/sounds/:id/play', (req, res) => {
  const sounds = read(SOUNDS);
  const sound = sounds.find((s) => s.id === req.params.id);
  if (!sound) return res.status(404).json({ error: 'Звук не знайдено' });
  sound.play_count += 1;
  write(SOUNDS, sounds);
  const history = read(HISTORY);
  const source = ['click', 'hotkey', 'random_mix'].includes(req.body.source) ? req.body.source : 'click';
  history.push({ id: String(Date.now()), sound_id: sound.id, timestamp: new Date().toISOString(), source });
  write(HISTORY, history);
  res.json(sound);
});

app.get('/api/stats/summary', (req, res) => {
  const sounds = read(SOUNDS);
  const history = read(HISTORY);
  const total = sounds.reduce((sum, s) => sum + s.play_count, 0);

  // Звук дня: найпопулярніший за останні 24 години
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const counts = {};
  history.filter((h) => new Date(h.timestamp).getTime() >= dayAgo)
    .forEach((h) => { counts[h.sound_id] = (counts[h.sound_id] || 0) + 1; });
  const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const sound = sounds.find((s) => s.id === topId);
  const soundOfTheDay = sound ? { ...sound, plays_today: counts[topId] } : null;

  // Найпопулярніша категорія
  const cats = {};
  sounds.forEach((s) => { cats[s.category] = (cats[s.category] || 0) + s.play_count; });
  const topCategory = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0] || null;

  res.json({ total_plays: total, sound_of_the_day: soundOfTheDay, top_category: topCategory });
});

app.listen(3000, () => console.log('Відкрий http://localhost:3000'));
