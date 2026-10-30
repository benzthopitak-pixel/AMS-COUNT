/* AssetSync · สถานะของหน้าจอ (S), งานที่เปิดอยู่ (meta), ทะเบียน (master) และดัชนีค้นหา */
let dev = LS.get('dev', null);
if (!dev) {
  dev = 'd' + Math.random().toString(36).slice(2, 7);
  LS.set('dev', dev);
}
const S = {
  mode: window.AndroidBridge || new URLSearchParams(location.search).get('mode') === 'app' ? 'app' : 'web',
  web: 'rounds',
  app: 'home',
  user: LS.get('user', null),
  area: LS.get('area', null),
  room: LS.get('room', ''),
  manual: false,
  areaTab: 'left',
  inboxTab: 'move',
  inboxSel: null,
  inboxChecked: new Set(),
  feedF: 'all',
  stTab: 'reprint',
  stSel: new Set(),
  stSize: LS.get('stSize', 'roll'),
  stMode: 'print',
  lblId: LS.get('lblId', 'std'),
  xls: null,
  xlsSel: new Set(),
  stCopies: 1,
  stPaste: '',
  cards: [],
  item: null,
  imp: null,
  msg: {},
  closeChoice: 'writeoff',
  confirmReset: false,
  verify: null,
  areaPick: false,
  liveArea: null,
  gate: 'boot',
  authed: false,
  team: LS.get('team', []),
  firstRun: false,
  gateMsg: null,
  busy: false
};
let meta = null; // round document
let master = new Map(),
  altIx = new Map(),
  subIx = new Map(),
  catIx = new Map(); // subIx: Asset → its Sub keys · catIx: Asset+Sub written together without '-' (old QR)
let serverEv = {}; // docId -> items (all devices)
let mine = []; // this device's events for the current round
let dirty = new Set(),
  writing = false,
  online = false;
let db = null,
  dl = null,
  RENDERING = false; // RENDERING: a focused field being replaced fires a stale change event — ignore it
const CHUNK = 350;

let usbMode = LS.get('usbMode', false),
  usbEv = {}; // usbEv: events that arrived by cable (file), per device
function loadMine() {
  usbEv = meta ? LS.get('usb-' + meta.id, {}) : {};
  mine = meta ? LS.get('mine-' + meta.id, []) : [];
  dirty = new Set(LS.get('dirty-' + (meta?.id || ''), []));
}
function saveMine() {
  if (meta) {
    LS.set('mine-' + meta.id, mine);
    LS.set('dirty-' + meta.id, [...dirty]);
  }
}

function indexMaster(rows) {
  master = new Map();
  altIx = new Map();
  subIx = new Map();
  catIx = new Map();
  for (const r of rows) {
    // r[8] Asset, r[9] Sub · registers imported before Sub support: an "Asset-Sub" code is split, anything else is Asset only
    const m = r[8] == null ? /^(\d+)-(\d{1,4})$/.exec(r[0]) : null;
    const asset = r[8] ?? (m ? m[1] : r[0]),
      sub = r[9] ?? (m ? subKey(m[2]) : '');
    master.set(r[0], {
      code: r[0],
      name: r[1],
      ccName: r[2],
      cls: r[3],
      alt: r[4],
      raws: r[5] || [],
      cc: ccKey(r[6]),
      wo: !!r[7],
      asset,
      sub
    });
    if (r[4]) altIx.set(r[4], r[0]);
    const l = subIx.get(asset);
    if (l) l.push(r[0]);
    else subIx.set(asset, [r[0]]);
  }
  const clash = new Set();
  for (const a of master.values()) {
    if (a.sub === '' || (subIx.get(a.asset) || []).length < 2) continue;
    for (const c of new Set([
      a.asset + a.sub,
      a.asset + a.sub.padStart(2, '0'),
      a.asset + a.sub.padStart(3, '0'),
      a.asset + a.sub.padStart(4, '0')
    ])) {
      if (master.has(c) || subIx.has(c)) continue;
      if (catIx.has(c) && catIx.get(c) !== a.code) clash.add(c);
      else catIx.set(c, a.code);
    }
  }
  for (const c of clash) catIx.delete(c); // two assets read the same way: never guess
}
const subsOf = code => {
  const a = master.get(code);
  return a ? subIx.get(a.asset) || [code] : [code];
};
