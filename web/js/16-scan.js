/* AssetSync · การสแกน: เสียงเตือน, แปลง QR/บาร์โค้ด → รหัสในทะเบียน (Asset, Asset-Sub, รูปแบบเก่า), บันทึกผลนับ */
let audio;
function beep(kind) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const tones = {
      ok: [[1320, 0.08]],
      dup: [
        [880, 0.08],
        [880, 0.08]
      ],
      unk: [[300, 0.25]],
      oth: [
        [1320, 0.08],
        [660, 0.12]
      ]
    }[kind] || [[1000, 0.05]];
    let at = audio.currentTime;
    for (const [f, d] of tones) {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.frequency.value = f;
      o.type = 'square';
      g.gain.value = 0.06;
      o.connect(g).connect(audio.destination);
      o.start(at);
      o.stop(at + d);
      at += d + 0.05;
    }
  } catch {}
  try {
    navigator.vibrate?.(kind === 'ok' ? 40 : [80, 60, 80]);
  } catch {}
}
/* QR / barcode → register key. Accepts every label printed so far:
 *   "51000001-1" / "51000001-0001"  Asset-Sub (standard from now on)
 *   "510000011"                     Asset+Sub with no '-' (old)        → qf 'concat'
 *   "51000001"                      Asset only; with several Subs the counter picks → qf 'asset' (old, ambiguous) */
function lookup(raw) {
  const t = norm(stripType(raw));
  if (!t) return { code: '' };
  const first = t.split(/[|;,\s]+/)[0];
  const byAsset = (asset, qf) => {
    const l = subIx.get(asset) || [];
    return l.length > 1 ? { multi: l, base: asset, qf: 'asset' } : { code: l[0], qf };
  };
  for (const c of t === first ? [t] : [t, first]) {
    const m = /^(.+)-(\d{1,4})$/.exec(c);
    if (m && subIx.has(m[1])) {
      const k = keyOf(m[1], subKey(m[2]));
      if (master.has(k)) return { code: k, qf: '' };
    }
    if (subIx.has(c)) return byAsset(c, '');
    if (master.has(c)) return { code: c, qf: '' };
    if (catIx.has(c)) return { code: catIx.get(c), qf: 'concat' };
    if (altIx.has(c)) return { code: altIx.get(c), qf: '' };
  }
  const base = first.split('-')[0];
  if (subIx.has(base)) return byAsset(base, '');
  return { code: first, qf: '' };
}
const resolve = raw => {
  const r = lookup(raw);
  return r.code || r.base || '';
};
const AIM = /^\][A-Za-z][0-9A-Za-z]/;
// CipherLab ReaderConfig → Data Output → "Display Code Type" puts the symbology name in front of the data, e.g. "QR Code51000001", "EAN138857129171164"
const CODE_TYPES = [
  'QR Code',
  'Micro QR',
  'MicroQR',
  'Data Matrix',
  'DataMatrix',
  'PDF417',
  'MicroPDF417',
  'Aztec',
  'MaxiCode',
  'Han Xin',
  'DotCode',
  'GS1 DataBar Expanded',
  'GS1 DataBar Limited',
  'GS1 DataBar',
  'GS1-128',
  'GS1 128',
  'EAN-128',
  'EAN128',
  'UCC/EAN-128',
  'Code 128',
  'Code128',
  'Code 39 Full ASCII',
  'Code 39',
  'Code39',
  'Code 93',
  'Code93',
  'Code 32',
  'Code 11',
  'Code11',
  'Italian Pharmacode',
  'Interleaved 2 of 5',
  'Industrial 2 of 5',
  'Matrix 2 of 5',
  'Standard 2 of 5',
  'IATA 2 of 5',
  'Codabar',
  'MSI',
  'Plessey',
  'Telepen',
  'Trioptic',
  'EAN-13',
  'EAN13',
  'EAN-8',
  'EAN8',
  'UPC-A',
  'UPCA',
  'UPC-E1',
  'UPC-E0',
  'UPC-E',
  'UPCE',
  'ISBN',
  'ISSN',
  'Composite',
  'RSS-14',
  'RSS'
].sort((x, y) => y.length - x.length);
const codeType = raw => {
  const t = String(raw ?? '').trim(),
    u = t.toUpperCase();
  const n = CODE_TYPES.find(k => u.startsWith(k.toUpperCase()) && t.length > k.length);
  return n ? { type: n, data: t.slice(n.length).trim() } : null;
};
const stripType = raw => {
  const t = String(raw ?? '')
    .trim()
    .replace(AIM, '');
  const c = codeType(t);
  return c ? c.data : t;
};
const srcOf = raw => {
  const t = String(raw ?? '').trim();
  if (S.manual) return 'manual';
  if (/^\]Q/i.test(t)) return 'qr';
  if (AIM.test(t)) return 'barcode';
  const c = codeType(t);
  if (c) return /QR/i.test(c.type) ? 'qr' : 'barcode';
  return /[\r\n]|https?:|No\s*\.?\s*:/i.test(t) ? 'qr' : 'barcode';
}; // no prefix at all: multi-line / labelled payloads only come from QR
function doScan(raw) {
  if (S.area && !S.area.shared && ccClosed(S.area.code)) {
    beep('dup');
    flash('CC นี้ปิดงานแล้ว · เปิดนับต่อก่อน');
    S.app = 'area';
    render();
    return;
  }
  const src = srcOf(raw);
  raw = stripType(raw);
  const r = lookup(raw);
  S.subPop = null;
  if ((!r.code && !r.multi) || !S.area) return;
  if (meta.status === 'closed') {
    flash('รอบนี้ปิดแล้ว');
    return;
  }
  // QR with the Asset only, and the Asset has several Subs: the counter says which ones are here
  if (r.multi) {
    beep('oth');
    S.dupPop = null;
    S.othPop = null;
    S.subPop = {
      base: r.base,
      keys: r.multi.slice().sort((x, y) => (+master.get(x).sub || 0) - (+master.get(y).sub || 0)),
      src,
      raw: String(raw).trim()
    };
    render();
    return;
  }
  countCode(r.code, src, r.qf ? { qf: r.qf, qraw: String(raw).trim() } : {});
}
// one count; extra = { qf, qraw } when the sticker is an old format (Asset only / no '-'): it goes on the reprint list
function countCode(code, src, extra = {}, quiet = false) {
  const prev = compute().cur.get(code);
  if (prev) {
    if (quiet) return false;
    beep('dup');
    S.othPop = null;
    S.dupPop = { code, by: prev.by, t: prev.t, where: prev.areaName };
    clearTimeout(S.dupT);
    S.dupT = setTimeout(() => {
      S.dupPop = null;
      render();
    }, 3500);
    render();
    return false;
  }
  S.dupPop = null;
  S.othPop = null;
  pushEvent({
    k: 'scan',
    code,
    round: meta.id,
    area: String(S.area.code),
    areaName: S.area.name,
    shared: !!S.area.shared,
    room: S.room,
    ns: S.manual,
    src,
    ...extra
  });
  const s = compute().cur.get(code);
  if (quiet) {
    S.cards.unshift({ code });
    return true;
  }
  beep(!master.has(code) ? 'unk' : isOther(s) ? 'oth' : 'ok');
  if (master.has(code) && isOther(s)) S.othPop = { code };
  S.cards.unshift({ code });
  render();
}
