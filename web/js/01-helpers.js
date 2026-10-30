/* AssetSync · ตัวช่วยทั่วไป: เลือก element, localStorage, จัดรูปแบบตัวเลข/วันที่, รหัส CC, Asset-Sub และ CC/วันที่บนป้าย */
const $ = s => document.querySelector(s);
const LS = {
  get(k, d) {
    try {
      const v = localStorage.getItem('amt.' + k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('amt.' + k, JSON.stringify(v));
    } catch {}
  }
};
// look of the app: 'sky' = glass on a blue sky (default) · 'classic' = the original flat colours · remembered per device
const THEMES = [
  ['sky', 'ท้องฟ้า'],
  ['classic', 'แบบเดิม']
];
function applyTheme(t) {
  if (!THEMES.some(([k]) => k === t)) t = 'sky';
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'sky' ? '#dcecfa' : '#3b5bfd');
  return t;
}
applyTheme(LS.get('theme', 'sky'));
const themeSwitch = () =>
  `<div class="theme-sw" role="group" aria-label="ธีม">${THEMES.map(([k, l]) => `<button type="button" data-a="theme" data-v="${k}" aria-pressed="${document.documentElement.dataset.theme === k}">${l}</button>`).join('')}</div>`;
const esc = s =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = s =>
  String(s ?? '')
    .trim()
    .toUpperCase();
// Cost Center is matched by its code only (names are just labels): ' 001010410 ' = '1010410'
const ccKey = v =>
  String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/\.0+$/, '')
    .replace(/^0+(?=\d)/, '');
// Sub-number: '0001' → '1', '' stays '' (file has no Sub column)
const subKey = v =>
  String(v ?? '')
    .trim()
    .replace(/\.0+$/, '')
    .replace(/^0+(?=\d)/, '');
// one register row per Asset + Sub: sub 0 keeps the plain Asset code (counts made before subs still match), others are "<Asset>-<Sub>"
const keyOf = (asset, sub) => (!sub || sub === '0' ? asset : asset + '-' + sub);
// what goes in the QR of a new sticker: always Asset-Sub (sub 0 included) when the file has a Sub column
const fullCode = a => (a ? (a.sub !== '' ? a.asset + '-' + a.sub : a.asset) : '');
const N = n => Number(n || 0).toLocaleString();
const fmtT = t =>
  t ? new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const hm = t => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const Store = window.AMSStore;
async function cap(n) {
  if (n === 'downloads') return Store.downloads;
  if (n === 'db') return S.authed ? Store.db : null;
  return null;
}
const VER = () => {
  const b = window.AMS_BUILD || 'dev';
  return /^\d/.test(b) ? 'v' + b : b;
};
const verTag = () =>
  `<span class="ver" title="เวอร์ชัน${window.AMS_BUILT ? ' · สร้างเมื่อ ' + esc(window.AMS_BUILT) : ''}">${esc(VER())}</span>`;
const isLead = () => usbMode || S.user?.role === 'lead';
function labelCC(code) {
  const a = master.get(code),
    s = compute().cur.get(code);
  if (s && s.rv.move === 'approved') return { code: s.area, name: s.areaName };
  return { code: a?.cc || '', name: a?.ccName || '' };
}
function dmy(s) {
  const iso = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2].padStart(2, '0')}/${m[1].padStart(2, '0')}/${m[3]}`;
  const m2 = String(s || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : String(s || '');
}
function capDate(a) {
  const i = meta?.headers ? meta.headers.findIndex(h => norm(h).includes('CAPITALIZED')) : -1;
  return i >= 0 && a.raws[0] ? dmy(a.raws[0][i]) : '';
}
