// РІВЕНЬ 1: API — тільки HTTP-запити до бекенду
const Api = {
  async req(url, opts = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Помилка сервера');
      err.status = res.status;
      throw err;
    }
    return data;
  },
  getSounds: (query) => Api.req('/api/sounds?' + query),
  addSound: (body) => Api.req('/api/sounds', { method: 'POST', body: JSON.stringify(body) }),
  updateSound: (id, body) => Api.req('/api/sounds/' + id, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSound: (id) => Api.req('/api/sounds/' + id, { method: 'DELETE' }),
  play: (id, source) => Api.req(`/api/sounds/${id}/play`, { method: 'POST', body: JSON.stringify({ source }) }),
  random: () => Api.req('/api/sounds/random', { method: 'POST' }),
  stats: () => Api.req('/api/stats/summary'),
};
