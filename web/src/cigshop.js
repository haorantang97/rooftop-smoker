// 烟柜弹窗：点店里的烟墙打开，不分国家，一整面密密麻麻的烟盒网格，点一盒看大图、拿一包。
// 排列按知名度：万宝路这些全球大牌 → 其他欧美烟 → 韩国 → 日本 → 中国（含港台）→ 东南亚、南亚、拉美、中东、非洲
import { CIGS, CIG } from '../../public/js/data.js';
import { t } from './i18n.js';

const BASE = import.meta.env.BASE_URL;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 烟盒缩略图：有资产图用图（先读压过的小图），没有就用两种主色画一个
function thumb(b, big = false) {
  if (b.img) return `<img loading="lazy" src="${BASE}gen/cig/${esc(b.id)}.png" data-full="${BASE}catalog/${esc(b.img)}" onerror="if(this.dataset.full){this.src=this.dataset.full;this.dataset.full=''}" alt="">`;
  return `<div class="swatch" style="background:linear-gradient(${b.pack[1]} 0 22%, ${b.pack[0]} 22% 100%)"><span style="color:${b.pack[1]}">${esc((b.nameEn || b.name).split(' ')[0])}</span>${big ? `<small>${esc(b.region)}</small>` : ''}</div>`;
}

export function createCigShop({ onTake, onToggle }) {
  const root = document.createElement('div');
  root.id = 'cigShop'; root.className = 'hidden';
  root.innerHTML = `
    <div class="panel" role="dialog" aria-label="${t('烟柜', 'Cigarettes')}">
      <header>
        <div class="title"><b>${t('烟柜', 'Cigarettes')}</b></div>
        <button class="x" aria-label="${t('关上', 'Close')}">×</button>
      </header>
      <div class="body">
        <section class="grid"></section>
        <aside class="detail"></aside>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const st = { sel: null };

  const brands = () => CIGS.filter((b) => b.catalog).length ? CIGS.filter((b) => b.catalog) : CIGS;
  // 全球大牌（按名气排；不管哪国出的版本，同一个牌子排在一起）
  const FAMOUS = ['marlboro', 'camel', 'lucky strike', 'winston', 'parliament', 'kent', 'dunhill', 'davidoff', 'l&m', 'chesterfield', 'pall mall', 'benson', 'newport', 'american spirit', 'philip morris', 'rothmans', 'vogue', 'virginia slims', 'gauloises', 'gitanes', 'sobranie', 'black devil', 'silk cut', 'john player', 'west', 'bond street', 'viceroy', 'state express'];
  const WEST = ['US', 'CA', 'GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'DK', 'SE', 'NO', 'FI', 'GR', 'PL', 'CZ', 'HU', 'UA', 'RU', 'AU', 'NZ'];
  const REST = ['VN', 'TH', 'MY', 'SG', 'PH', 'ID', 'IN', 'PK', 'BD', 'LK', 'MX', 'CU', 'BR', 'AR', 'CL', 'CO', 'PE', 'TR', 'IR', 'IL', 'EG', 'MA', 'ZA', 'NG', 'KE'];
  const FAMOUS_RE = FAMOUS.map((k) => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}([^a-z]|$)`));
  const famous = (b) => { const s = (b.insp || '').toLowerCase(); return FAMOUS_RE.findIndex((re) => re.test(s)); };
  function rank(b) {
    const f = famous(b), c = b.country;
    if (f >= 0) return [0, f];
    if (WEST.includes(c)) return [1, WEST.indexOf(c)];
    if (c === 'KR') return [2, 0];
    if (c === 'JP') return [3, 0];
    if (c === 'CN' || c === 'TW' || c === 'HK' || c === 'MO') return [4, ['CN', 'HK', 'MO', 'TW'].indexOf(c)];
    const r = REST.indexOf(c); return [5, r < 0 ? 99 : r];
  }
  let sorted = null, sortedN = -1;
  const list = () => {
    const all = brands(); if (sorted && sortedN === all.length) return sorted;
    const idx = new Map(all.map((b, i) => [b.id, i]));
    sorted = all.map((b) => [b, rank(b)]).sort((x, y) => x[1][0] - y[1][0] || x[1][1] - y[1][1] || idx.get(x[0].id) - idx.get(y[0].id)).map((x) => x[0]); sortedN = all.length;
    return sorted;
  };
  function renderGrid() {
    $('.grid').innerHTML = list().map((b) => `<button class="card ${st.sel === b.id ? 'on' : ''}" data-id="${esc(b.id)}">${thumb(b)}</button>`).join('');
  }
  function renderDetail() {
    const b = st.sel && CIG[st.sel];
    if (!b) { $('.detail').innerHTML = ''; return; }
    $('.detail').innerHTML = `
      <div class="big">${thumb(b, true)}</div>
      <button class="take primary">${t('来一包', 'Take a pack')}</button>`;
  }
  const renderAll = () => { renderGrid(); renderDetail(); };

  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('.x')) return close();
    const card = e.target.closest('.card'); if (card) { st.sel = card.dataset.id; renderGrid(); renderDetail(); root.classList.add('picked'); return; }
    if (e.target.closest('.take') && st.sel) { onTake(st.sel); close(); }
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });

  function open(id) {
    if (id && CIG[id]) st.sel = id; else if (!st.sel) st.sel = list()[0]?.id || null;
    renderAll(); root.classList.remove('hidden'); root.classList.toggle('picked', !!st.sel); onToggle?.(true);
    setTimeout(() => root.querySelector('.card.on')?.scrollIntoView({ block: 'nearest' }), 0);
  }
  function close() { if (root.classList.contains('hidden')) return; root.classList.add('hidden'); onToggle?.(false); }
  return { open, close, isOpen: () => !root.classList.contains('hidden') };
}
