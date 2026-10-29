/* AssetSync · คำนวณผลนับปัจจุบันจาก events (scan / edit / del / rv) และจัดกลุ่มเรื่องที่ต้องตรวจ */
function allEvents() {
  const m = new Map();
  for (const k in serverEv) for (const e of serverEv[k]) m.set(e.id, e);
  for (const k in usbEv) for (const e of usbEv[k]) m.set(e.id, e);
  for (const e of mine) m.set(e.id, e);
  return [...m.values()].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
}
let _cache = null,
  _cacheKey = '';
function compute() {
  const evs = allEvents();
  const key = evs.length + ':' + (evs.at(-1)?.id || '') + ':' + Object.keys(serverEv).length + ':' + master.size;
  if (_cache && key === _cacheKey) return _cache;
  const cur = new Map(),
    recount = new Set(),
    hist = new Map(),
    ccDone = new Map(),
    lost = new Map(),
    dups = new Map();
  const H = (c, txt, e) => {
    let h = hist.get(c);
    if (!h) hist.set(c, (h = []));
    h.push({ t: e.t, by: e.by, txt });
  };
  const dropped = new Set(evs.filter(e => e.k === 'edit' && e.dropScan).map(e => e.dropScan)); // duplicate scans someone removed
  for (const e of evs) {
    const c = e.code;
    let s = cur.get(c);
    if (e.k === 'edit' && e.dropScan) {
      H(c, 'ลบรายการสแกนซ้ำ', e);
      continue;
    }
    if (e.k === 'scan' && dropped.has(e.id)) continue;
    if (String(c).startsWith('#CC:')) {
      const k = c.slice(4);
      if (e.areaDone) ccDone.set(k, { by: e.by, t: e.t, left: e.left || 0, dev: e.dev });
      else ccDone.delete(k);
      continue;
    } // "นับครบแล้ว" for one Cost Center
    if (e.k === 'edit' && e.lost !== undefined && !s) {
      if (e.lost) {
        lost.set(c, { by: e.by, t: e.t, remark: e.remark || '', area: e.area || '' });
        H(c, 'บันทึกว่าสูญหาย' + (e.remark ? ' · ' + e.remark : ''), e);
      } else {
        lost.delete(c);
        H(c, 'ยกเลิกสูญหาย', e);
      }
      continue;
    }
    if (e.k === 'scan') {
      if (s) {
        H(c, `สแกนซ้ำที่ ${e.areaName || ''}`, e);
        if (e.dev !== s.dev) {
          const l = dups.get(c) || [];
          l.push({ id: e.id, by: e.by, dev: e.dev, area: e.area, areaName: e.areaName, t: e.t });
          dups.set(c, l);
        }
        continue;
      } // two scanners counted it while offline: the earlier scan counts, Admin sees both
      lost.delete(c);
      cur.set(c, {
        code: c,
        t: e.t,
        by: e.by,
        dev: e.dev,
        area: e.area,
        areaName: e.areaName,
        shared: !!e.shared,
        room: e.room || '',
        ns: !!e.ns,
        src: e.src || (e.ns ? 'manual' : 'barcode'),
        cond: 'ปกติ',
        remark: '',
        dec: null,
        uname: '',
        flags: { reprint: !!e.ns },
        rv: {},
        printedAt: 0,
        qf: e.qf || '',
        qraw: e.qraw || ''
      });
      recount.delete(c);
      H(c, `${SRC[e.src || (e.ns ? 'manual' : 'barcode')][0]} · พบที่ ${e.areaName}${e.room ? ' · ' + e.room : ''}`, e);
    } else if (!s && e.k !== 'rv') {
      continue;
    } else if (e.k === 'edit') {
      for (const f of ['cond', 'remark', 'room', 'dec', 'uname', 'area', 'areaName'])
        if (e[f] !== undefined) s[f] = e[f];
      if (e.flags) {
        Object.assign(s.flags, e.flags);
        delete s.flags.transferred;
      }
      if (e.printed) {
        s.flags.reprint = false;
        s.flags.namebad = false;
        s.printedAt = e.t;
      }
      if (e.hasQR !== undefined) s.hasQR = !!e.hasQR;
      H(
        c,
        e.printed
          ? 'พิมพ์ป้ายใหม่แล้ว'
          : e.hasQR !== undefined
            ? e.hasQR
              ? 'ยืนยันว่ามีสติกเกอร์ QR แล้ว'
              : 'ยกเลิก: ยังไม่มีสติกเกอร์ QR'
            : 'แก้ไข: ' +
              Object.keys(e)
                .filter(k => !['id', 'k', 'code', 't', 'by', 'dev', 'round'].includes(k))
                .map(k =>
                  k === 'flags'
                    ? 'ป้าย/โอนย้าย'
                    : ({
                        cond: 'สภาพ',
                        remark: 'Remark',
                        room: 'ห้อง',
                        dec: 'การตัดสินใจ',
                        uname: 'ชื่อ',
                        area: 'CC ที่พบ',
                        areaName: ''
                      }[k] ?? k)
                )
                .join(', '),
        e
      );
    } else if (e.k === 'del') {
      cur.delete(c);
      H(c, 'ยกเลิกผลนับ', e);
    } else if (e.k === 'rv') {
      if (e.act === 'recount') {
        cur.delete(c);
        recount.add(c);
        H(c, 'Admin สั่งตรวจนับซ้ำ', e);
        continue;
      }
      if (!s) continue;
      if (e.act === 'approve_move') {
        s.rv.move = 'approved';
        s.flags.pendingTransfer = true;
        s.flags.reprint = true;
        s.dec = s.dec || 'moved';
        H(c, 'Admin อนุมัติย้ายแผนก', e);
      }
      if (e.act === 'dup_ack') {
        s.rv.dup = 'ack';
        H(c, 'Admin: รับทราบสแกนซ้ำ', e);
      }
      if (e.act === 'keep') {
        s.rv.move = 'keep';
        s.dec = 'borrowed';
        H(c, 'Admin: ไม่ย้าย (ยืมมา)', e);
      }
      if (e.act === 'unk_accept') {
        s.rv.unk = 'accepted';
        H(c, 'Admin: รับเข้าทะเบียน', e);
      }
      if (e.act === 'unk_reject') {
        s.rv.unk = 'rejected';
        H(c, 'Admin: ไม่ใช่ทรัพย์สินของบริษัท', e);
      }
      if (e.act === 'dmg_ack') {
        s.rv.dmg = 'ack';
        H(c, 'Admin รับทราบสภาพ', e);
      }
    }
  }
  _cacheKey = key;
  _cache = { cur, recount, hist, evs, ccDone, lost, dups };
  return _cache;
}
// where a count came from: QR sticker, barcode, typed / searched on the scanner, or recorded on the web
const SRC = {
  qr: ['สแกน QR', 'c-ok'],
  barcode: ['สแกนบาร์โค้ด', 'c-gray'],
  manual: ['พิมพ์ / ค้นหาบนเครื่อง', 'c-warn'],
  web: ['บันทึกบนเว็บ', 'c-blue']
};
const srcChip = s => (s ? `<span class="chip ${SRC[s.src][1]}">${SRC[s.src][0]}</span>` : '');
const hasQR = s => !!s && (s.src === 'qr' || !!s.hasQR); // scanned from a QR, or Admin confirmed the asset already has a QR sticker
const needQR = s => !!s && master.has(s.code) && !hasQR(s) && !s.printedAt; // QR present = sticker already done
const oldQR = s => !!s && !!s.qf && master.has(s.code) && !s.printedAt; // scanned from an old-format QR (Asset only / no '-'): needs a new Asset-Sub sticker
const dupOf = code => {
  const s2 = compute().cur.get(code),
    l = compute().dups.get(code);
  return l && s2 && !s2.rv.dup ? l : null;
};
const myDups = () => {
  const { dups, cur } = compute(),
    out = [];
  for (const [code, l] of dups) for (const d of l) if (d.dev === dev) out.push({ ...d, code, first: cur.get(code) });
  return out;
};
const lostOf = code => compute().lost.get(code) || null;
// choices for an item nobody has scanned: found (no sticker / with its condition) or lost
const markChoices = (code, act, extra = '') => {
  const L = lostOf(code);
  if (L)
    return `<div class="card" style="background:var(--bad-soft, #fef3f2);padding:12px;gap:6px"><b style="color:var(--bad-ink)">บันทึกว่าสูญหายแล้ว</b><span class="sub">${esc(L.by)} · ${fmtT(L.t)}${L.remark ? ' · ' + esc(L.remark) : ''}</span><div class="row"><button class="btn sm" data-a="unlost" data-v="${esc(code)}">ยกเลิก (กลับเป็นรอตรวจ)</button></div></div>`;
  const B = (c, l, cls) =>
    `<button class="btn ${cls}" data-a="${act}" data-v="${esc(code)}" data-c="${c}" ${extra}>${l}</button>`;
  return `<div class="card" style="background:#f8f9fc;padding:12px;gap:8px"><b>บันทึกผลรายการนี้</b><span class="sub">พบทรัพย์สินแต่สแกนไม่ได้ / ไม่มีสติกเกอร์ · หรือค้นหาไม่พบ</span>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${B('ปกติ', 'พบ · ไม่มีสติกเกอร์', 'pri')}${B('ชำรุด', 'พบ · ชำรุด', '')}${B('รอซ่อม', 'พบ · รอซ่อม', '')}${B('ไม่ใช้งาน', 'พบ · ไม่ใช้งาน', '')}</div>
    <input class="in" id="mkRemark-${esc(code)}" placeholder="Remark (ไม่บังคับ)">${B('lost', 'สูญหาย / ค้นหาไม่พบ', 'red')}</div>`;
};
const ccClosed = code => compute().ccDone.get(String(code)) || null;
const closeTxt = d => `ปิดงานโดย ${esc(d.by)} · ${fmtT(d.t)}${d.left ? ` · ไม่พบ ${d.left} รายการ` : ''}`;
const isOther = s => {
  const a = master.get(s.code);
  return !!(a && !s.shared && s.area && a.cc && ccKey(s.area) !== ccKey(a.cc));
};
// same CC code but the file spells the department differently → warn only, never counts as a move
const ccNameOf = code => (meta?.areas || []).find(x => String(x.code) === String(code))?.name || String(code);
const ccNameDiff = code => (meta?.ccNames || {})[String(code)] || null;
const isBorrowed = s => isOther(s) && (s.dec === 'borrowed' || s.rv.move === 'keep'); // borrowed from another CC: found, but never a CC move
const isMoveCase = s => isOther(s) && !isBorrowed(s);
const isMoved = s => isMoveCase(s);
const counted = a => !a.wo; // rows already written off before this round are not counted

function cats() {
  const { cur } = compute(),
    out = { move: [], unk: [], dmg: [], reprint: [], namebad: [], transfer: [], cleared: [] };
  for (const s of cur.values()) {
    const a = master.get(s.code);
    if (isOther(s) && s.dec !== 'borrowed' && !s.rv.move) out.move.push(s);
    if (!a && !s.rv.unk) out.unk.push(s);
    if ((s.cond === 'ชำรุด' || s.cond === 'รอซ่อม') && !s.rv.dmg) out.dmg.push(s);
    if (s.flags.reprint) out.reprint.push(s);
    if (s.flags.namebad) out.namebad.push(s);
    if (s.flags.pendingTransfer) out.transfer.push(s);
    if (s.rv.move || s.rv.unk || s.rv.dmg) out.cleared.push(s);
  }
  return out;
}
