/* AssetSync · เมนู 4.2 รายงานสรุปผล: ตารางบนจอ, Dashboard, รายงานที่จัดกลุ่มเอง และไฟล์ Excel/PDF */
const REP_TABS = [
  ['dash', 'ภาพรวม (Dashboard)'],
  ['files', 'ไฟล์ส่งออก / ส่งรายงาน'],
  ['sum', 'สรุปผลตรวจนับ'],
  ['nf', 'รายการที่ตรวจไม่พบ'],
  ['qr', 'ต้องพิมพ์ QR ใหม่'],
  ['mv', 'รายการย้ายแผนก'],
  ['bw', 'รายการยืมมา'],
  ['cr', 'สรุปตามที่เลือก (เช่น เลข Mat)']
];
// custom report: group by any column of the imported file, pick the columns to print
const RES_F = [
  ['r:res', 'ผลการนับ'],
  ['r:cond', 'สภาพ'],
  ['r:area', 'CC ที่พบ'],
  ['r:areaName', 'ชื่อ CC ที่พบ'],
  ['r:by', 'ผู้นับ'],
  ['r:t', 'เวลานับ'],
  ['r:src', 'วิธีตรวจนับ'],
  ['r:qr', 'QR'],
  ['r:remark', 'Remark']
];
function crFields() {
  return (meta.headers || []).map((h, i) => ['h:' + i, h]).concat(RES_F);
}
function crConf() {
  if (S.cr && S.cr.job === meta.id) return S.cr;
  const H = meta.headers || [],
    find = re => H.findIndex(h => re.test(norm(h))),
    m0 = meta.map || {};
  let g = find(/\bMAT|MATERIAL/);
  if (g < 0) g = find(/ASSET CLASS|^CLASS/);
  if (g < 0) g = m0.cc ?? 0;
  const saved = LS.get('cr-' + meta.id, null);
  S.cr = saved || {
    job: meta.id,
    group: 'h:' + g,
    mode: 'sum',
    status: 'all',
    cols: ['h:' + (m0.code ?? 0), 'h:' + (m0.name ?? 1), 'h:' + (m0.cc ?? 2), 'r:res', 'r:cond', 'r:by'].filter(
      x => !/:-1$/.test(x)
    )
  };
  return S.cr;
}
function crVal(key, a, s2) {
  const [k, f] = key.split(':');
  if (k === 'h') return a.raws[0]?.[+f] ?? '';
  const L = !s2 && lostOf(a.code);
  return (
    {
      res: s2 ? (isMoved(s2) ? 'พบ (ย้ายแผนก)' : isOther(s2) ? 'พบ (ยืมมา)' : 'พบ') : L ? 'สูญหาย' : 'ไม่พบ',
      cond: s2?.cond || '',
      area: s2 ? String(s2.area) : '',
      areaName: s2?.areaName || '',
      by: s2?.by || L?.by || '',
      t: s2 ? fmtT(s2.t) : '',
      src: s2 ? SRC[s2.src][0] : '',
      qr: !s2 ? '' : hasQR(s2) ? 'ครบ' : s2.printedAt ? 'ติดแล้ว' : 'ต้องสร้าง',
      remark: s2?.remark || L?.remark || ''
    }[f] ?? ''
  );
}
const crLabel = key => (crFields().find(([k]) => k === key) || [key, key])[1];
function reportData(kind) {
  const { cur } = compute(),
    ccF = S.repCC || '',
    inCC = a => !ccF || String(a.cc) === ccF;
  if (kind === 'sum') {
    const by = new Map();
    for (const a of master.values()) {
      if (!counted(a) || !inCC(a)) continue;
      const s2 = cur.get(a.code),
        e = by.get(String(a.cc)) || { cc: String(a.cc), total: 0, found: 0, lost: 0, mv: 0, dmg: 0, qr: 0 };
      e.total++;
      if (s2) {
        e.found++;
        if (isMoved(s2)) e.mv++;
        if (s2.cond !== 'ปกติ') e.dmg++;
        if (needQR(s2) || oldQR(s2) || s2.flags.reprint) e.qr++;
      } else if (lostOf(a.code)) e.lost++;
      by.set(e.cc, e);
    }
    const rows = [...by.values()]
      .sort((x, y) => x.cc.localeCompare(y.cc))
      .map(e => [
        e.cc,
        ccNameOf(e.cc),
        e.total,
        e.found,
        e.total - e.found - e.lost,
        e.lost,
        e.mv,
        e.dmg,
        e.qr,
        e.total ? Math.round((e.found / e.total) * 1000) / 10 + '%' : '0%',
        ccClosed(e.cc) ? 'ปิดแล้ว' : ''
      ]);
    const tot = rows.reduce(
      (t, r) => {
        for (let i = 2; i <= 8; i++) t[i] += r[i];
        return t;
      },
      ['รวม', '', 0, 0, 0, 0, 0, 0, 0]
    );
    tot.push(tot[2] ? Math.round((tot[3] / tot[2]) * 1000) / 10 + '%' : '0%', '');
    rows.push(tot);
    return {
      title: 'สรุปผลตรวจนับ',
      head: [
        'Cost Center',
        'ชื่อ CC',
        'ทั้งหมด',
        'ตรวจแล้ว',
        'ไม่พบ',
        'สูญหาย',
        'ย้ายแผนก',
        'ชำรุด ฯลฯ',
        'ต้องพิมพ์ QR',
        '% ตรวจแล้ว',
        'ปิดงาน'
      ],
      rows,
      w: [11, 22, 8, 8, 8, 8, 8, 9, 10, 9, 8],
      num: [2, 3, 4, 5, 6, 7, 8]
    };
  }
  if (kind === 'pv') {
    const tb = document.querySelector('#pivotBox table.pvtTable');
    if (!tb) return { title: 'Pivot', head: ['ยังไม่มีตาราง'], rows: [], w: [100] };
    const aoa = XLSX.utils.sheet_to_json(XLSX.utils.table_to_sheet(tb, { raw: true }), { header: 1, defval: '' });
    const cfg = LS.get('pv-' + meta.id, {}),
      n = Math.max(...aoa.map(r => r.length), 1);
    return {
      title:
        'Pivot' +
        (cfg.rows?.length ? ' · ' + cfg.rows.join(' / ') : '') +
        (cfg.cols?.length ? ' × ' + cfg.cols.join(' / ') : ''),
      head: Array.from({ length: n }, (_, i) => String(aoa[0]?.[i] ?? '')),
      rows: aoa
        .slice(1)
        .map(r =>
          Array.from({ length: n }, (_, i) => r[i] ?? '').map((v, i) =>
            i >= ((cfg.rows || []).length || 1) && typeof v === 'string' && /^-?[\d,]+(\.\d+)?$/.test(v.trim())
              ? Number(v.replace(/,/g, ''))
              : v
          )
        ),
      w: Array(n).fill(10),
      num: [...Array(n).keys()].slice((cfg.rows || []).length || 1)
    };
  }
  if (kind === 'cr') {
    const C = crConf(),
      stOk = (a, s2) =>
        C.status === 'all' ||
        (C.status === 'found'
          ? !!s2
          : C.status === 'nf'
            ? !s2
            : C.status === 'lost'
              ? !s2 && !!lostOf(a.code)
              : C.status === 'mv'
                ? !!s2 && isOther(s2)
                : true);
    const list = [...master.values()]
      .filter(a => counted(a) && inCC(a))
      .map(a => ({ a, s2: cur.get(a.code) }))
      .filter(x => stOk(x.a, x.s2));
    const gv = x => String(crVal(C.group, x.a, x.s2) || '(ว่าง)');
    if (C.mode === 'sum') {
      const by = new Map();
      for (const x of list) {
        const k = gv(x),
          e = by.get(k) || [k, 0, 0, 0, 0, 0];
        e[1]++;
        if (x.s2) {
          e[2]++;
          if (isOther(x.s2)) e[5]++;
        } else if (lostOf(x.a.code)) e[4]++;
        else e[3]++;
        by.set(k, e);
      }
      const rows = [...by.values()]
        .sort((x, y) => String(x[0]).localeCompare(String(y[0]), 'th', { numeric: true }))
        .map(e => [...e, e[1] ? Math.round((e[2] / e[1]) * 1000) / 10 + '%' : '0%']);
      const tot = rows.reduce(
        (t, r) => {
          for (let i = 1; i <= 5; i++) t[i] += r[i];
          return t;
        },
        ['รวม', 0, 0, 0, 0, 0]
      );
      tot.push(tot[1] ? Math.round((tot[2] / tot[1]) * 1000) / 10 + '%' : '0%');
      rows.push(tot);
      return {
        title: 'สรุปตาม ' + crLabel(C.group),
        head: [crLabel(C.group), 'ทั้งหมด', 'ตรวจแล้ว', 'ไม่พบ', 'สูญหาย', 'ย้ายแผนก', '% ตรวจแล้ว'],
        rows,
        w: [30, 12, 12, 12, 12, 12, 12],
        num: [1, 2, 3, 4, 5, 6],
        totRow: true
      };
    }
    const cols = C.cols.filter(k => k !== C.group),
      rows = list
        .sort((x, y) => gv(x).localeCompare(gv(y), 'th', { numeric: true }) || x.a.code.localeCompare(y.a.code))
        .map(x => [gv(x), ...cols.map(k => crVal(k, x.a, x.s2))]);
    return {
      title: 'รายการตาม ' + crLabel(C.group),
      head: [crLabel(C.group), ...cols.map(crLabel)],
      rows,
      w: [12, ...cols.map(k => (/DESC|ชื่อ|NAME/i.test(crLabel(k)) ? 26 : 11))]
    };
  }
  if (kind === 'nf') {
    const rows = [...master.values()]
      .filter(a => counted(a) && inCC(a) && !cur.has(a.code))
      .sort((x, y) => String(x.cc).localeCompare(String(y.cc)) || x.code.localeCompare(y.code))
      .map(a => {
        const L = lostOf(a.code);
        return [
          a.code,
          a.name,
          String(a.cc),
          ccNameOf(a.cc),
          L ? 'สูญหาย' : 'ไม่พบ',
          L ? `${L.by} · ${fmtT(L.t)}` : '',
          L?.remark || ''
        ];
      });
    return {
      title: 'รายการที่ตรวจไม่พบ',
      head: ['Asset', 'ชื่อทรัพย์สิน', 'CC', 'ชื่อ CC', 'สถานะ', 'บันทึกโดย', 'Remark'],
      rows,
      w: [11, 30, 10, 16, 8, 16, 18]
    };
  }
  if (kind === 'qr') {
    const rows = [...cur.values()]
      .filter(s2 => {
        const a = master.get(s2.code);
        return (
          a && inCC(a) && (needQR(s2) || oldQR(s2) || s2.flags.reprint || s2.flags.namebad || s2.rv.move === 'approved')
        );
      })
      .sort((x, y) => x.code.localeCompare(y.code))
      .map(s2 => {
        const a = master.get(s2.code),
          cc = labelCC(s2.code);
        return [
          s2.code,
          a.name,
          cc.code,
          cc.name,
          [
            needQR(s2) && 'ยังไม่มี QR',
            oldQR(s2) && `QR รูปแบบเก่า (${s2.qraw || 'ไม่มีเลข Sub'})`,
            s2.flags.reprint && 'ขอพิมพ์ใหม่',
            s2.flags.namebad && 'ชื่อไม่ตรง',
            s2.rv.move === 'approved' && 'ย้ายแผนก'
          ]
            .filter(Boolean)
            .join(' · '),
          SRC[s2.src][0],
          s2.printedAt ? fmtT(s2.printedAt) : ''
        ];
      });
    return {
      title: 'รายการที่ต้องพิมพ์ QR ใหม่',
      head: ['Asset', 'ชื่อทรัพย์สิน', 'CC บนป้าย', 'ชื่อ CC', 'เหตุผล', 'วิธีตรวจนับ', 'พิมพ์ล่าสุด'],
      rows,
      w: [11, 30, 10, 16, 20, 14, 12]
    };
  }
  if (kind === 'bw') {
    const rows = [...cur.values()]
      .filter(s2 => {
        const a = master.get(s2.code);
        return a && isBorrowed(s2) && (!ccF || String(a.cc) === ccF || String(s2.area) === ccF);
      })
      .sort((x, y) => x.code.localeCompare(y.code))
      .map(s2 => {
        const a = master.get(s2.code);
        return [
          s2.code,
          a.name,
          String(a.cc),
          ccNameOf(a.cc),
          String(s2.area),
          s2.areaName,
          s2.rv.move === 'keep' ? 'Admin ยืนยันว่ายืมมา' : 'ผู้ตรวจนับแจ้งว่ายืมมา',
          s2.by,
          fmtT(s2.t)
        ];
      });
    return {
      title: 'รายการยืมมา (ไม่ย้าย CC)',
      head: [
        'Asset',
        'ชื่อทรัพย์สิน',
        'CC เจ้าของ',
        'ชื่อ CC เจ้าของ',
        'CC ที่ยืมไปใช้',
        'ชื่อ CC ที่ยืม',
        'สถานะ',
        'ผู้นับ',
        'เวลานับ'
      ],
      rows,
      w: [11, 24, 10, 13, 10, 13, 15, 10, 11]
    };
  }
  const rows = [...cur.values()]
    .filter(s2 => {
      const a = master.get(s2.code);
      return a && isMoveCase(s2) && (!ccF || String(a.cc) === ccF || String(s2.area) === ccF);
    })
    .sort((x, y) => x.code.localeCompare(y.code))
    .map(s2 => {
      const a = master.get(s2.code);
      return [
        s2.code,
        a.name,
        String(a.cc),
        ccNameOf(a.cc),
        String(s2.area),
        s2.areaName,
        decLabel(s2.dec).replace('ผู้ตรวจนับ: ', ''),
        s2.rv.move === 'approved'
          ? 'รอโอนย้าย'
          : s2.rv.move === 'keep' || s2.dec === 'borrowed'
            ? 'ไม่ย้าย (ยืมมา)'
            : 'รอ Admin อนุมัติ',
        s2.by
      ];
    });
  return {
    title: 'รายการย้ายแผนก',
    head: [
      'Asset',
      'ชื่อทรัพย์สิน',
      'CC ทะเบียน',
      'ชื่อ CC เดิม',
      'CC ที่พบ',
      'ชื่อ CC ที่พบ',
      'ผู้ตรวจนับแจ้ง',
      'สถานะ',
      'ผู้นับ'
    ],
    rows,
    w: [11, 24, 10, 13, 10, 13, 10, 15, 10]
  };
}
function editDialog(code) {
  const s2 = compute().cur.get(code),
    a = master.get(code);
  if (!s2) {
    S.editPop = null;
    return '';
  }
  const f = S.editF || (S.editF = { what: null });
  const W = (k, l) =>
    `<button class="tog" aria-pressed="${f.what === k}" data-a="editwhat" data-v="${k}">${l}</button>`;
  let body = '';
  if (f.what === 'cond')
    body = `<div class="chips">${['ปกติ', 'ชำรุด', 'รอซ่อม', 'ไม่ใช้งาน'].map(x => `<button class="tog" aria-pressed="${s2.cond === x}" data-a="edset" data-f="cond" data-c="${x}" data-v="${esc(code)}">${x}</button>`).join('')}</div>`;
  if (f.what === 'remark')
    body = `<input class="in" id="edRemark" value="${esc(s2.remark)}" placeholder="Remark"><button class="btn pri" data-a="edsave" data-f="remark" data-v="${esc(code)}" style="align-self:flex-start">บันทึก</button>`;
  if (f.what === 'room')
    body = `<input class="in" id="edRoom" value="${esc(s2.room)}" placeholder="เช่น ชั้น 2 ห้องประชุม"><button class="btn pri" data-a="edsave" data-f="room" data-v="${esc(code)}" style="align-self:flex-start">บันทึก</button>`;
  if (f.what === 'area')
    body = `<select class="in" id="edArea">${(meta.areas || []).map(x => `<option value="${esc(x.code)}" ${String(x.code) === String(s2.area) ? 'selected' : ''}>${esc(x.code)}${x.name !== String(x.code) ? ' · ' + esc(x.name) : ''}</option>`).join('')}</select><button class="btn pri" data-a="edsave" data-f="area" data-v="${esc(code)}" style="align-self:flex-start">บันทึก</button>`;
  if (f.what === 'flags') body = `<div class="chips">${flagChips(s2, 'leadflag')}</div>`;
  return `<div class="dupbg" data-a="closeedit" role="dialog" aria-labelledby="edH"><div class="card" data-stop="1" style="width:100%;max-width:460px;gap:12px">
    <div class="row" style="justify-content:space-between;align-items:center"><b id="edH" style="font-size:18px">แก้ไข <span class="mono">${esc(code)}</span></b><button class="btn sm" data-a="closeedit">ปิด</button></div>
    <span class="sub">${esc(a?.name || s2.uname || '')} · ตอนนี้: ${esc(s2.cond)} · พบที่ ${esc(s2.areaName)}${s2.room ? ' · ' + esc(s2.room) : ''}${s2.remark ? ' · ' + esc(s2.remark) : ''}</span>
    <b>ต้องการแก้ไขอะไร?</b><div class="chips">${W('cond', 'สภาพ')}${W('remark', 'Remark')}${W('area', 'CC ที่พบ')}${W('room', 'ห้อง / Location')}${W('flags', 'ป้าย + การโอนย้าย')}</div>
    ${body ? `<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:10px">${body}</div>` : ''}</div></div>`;
}
function crPanel() {
  const C = crConf(),
    F = crFields(),
    H = F.filter(([k]) => k.startsWith('h:'));
  const tog = (k, l) =>
    `<button class="tog" aria-pressed="${C.cols.includes(k)}" data-a="crcol" data-v="${esc(k)}">${C.cols.includes(k) ? '✓ ' : ''}${esc(l)}</button>`;
  return `<section class="card" style="gap:10px"><h2>เลือกสิ่งที่จะพิมพ์</h2><div class="fbar">
    <label class="f" style="flex-direction:row;align-items:center;gap:6px">จัดกลุ่มตาม<select class="in" data-cr="group">${F.map(([k, l]) => `<option value="${esc(k)}" ${C.group === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    <label class="f" style="flex-direction:row;align-items:center;gap:6px">แบบ<select class="in" data-cr="mode"><option value="sum" ${C.mode === 'sum' ? 'selected' : ''}>สรุปจำนวนต่อกลุ่ม</option><option value="list" ${C.mode === 'list' ? 'selected' : ''}>รายการทั้งหมดเรียงตามกลุ่ม</option></select></label>
    <label class="f" style="flex-direction:row;align-items:center;gap:6px">รายการ<select class="in" data-cr="status">${[
      ['all', 'ทั้งหมด'],
      ['found', 'ตรวจแล้ว'],
      ['nf', 'ยังไม่พบ'],
      ['lost', 'สูญหาย'],
      ['mv', 'ย้ายแผนก']
    ]
      .map(([k, l]) => `<option value="${k}" ${C.status === k ? 'selected' : ''}>${l}</option>`)
      .join('')}</select></label></div>
    ${C.mode === 'list' ? `<span class="sub">คอลัมน์ที่จะพิมพ์ (จากไฟล์ที่นำเข้า)</span><div class="chips">${H.map(([k, l]) => tog(k, l)).join('')}</div><span class="sub">ผลการตรวจนับ</span><div class="chips">${RES_F.map(([k, l]) => tog(k, l)).join('')}</div>` : ''}
    <span class="sub">ระบบจำตัวเลือกไว้ให้ครั้งหน้า</span></section>`;
}
// moves still waiting for Admin: approve them all with one tap (each becomes "รอโอนย้าย" + new sticker)
const pendingMoves = (ccF = '') =>
  [...compute().cur.values()].filter(s2 => {
    const a = master.get(s2.code);
    return (
      a &&
      isOther(s2) &&
      !s2.rv.move &&
      s2.dec !== 'borrowed' &&
      (!ccF || String(a.cc) === ccF || String(s2.area) === ccF)
    );
  });
const bulkMoveBox = (ccF, where) => {
  const n = pendingMoves(ccF).length;
  if (!n || !isLead()) return '';
  return S.confirmBulk === where
    ? `<div class="confirm"><b>อนุมัติย้ายแผนกทั้งหมด ${n} รายการ?</b><span>ทุกรายการจะเป็น "รอโอนย้าย" และเข้าคิวพิมพ์ QR ใหม่ · รายการที่ผู้ตรวจนับแจ้งว่า "ยืมมา" ไม่รวม</span><div class="row"><button class="btn oth" data-a="bulkmove" data-v="${esc(ccF)}">ยืนยันอนุมัติ ${n} รายการ</button><button class="btn" data-a="nobulk">ยกเลิก</button></div></div>`
    : `<button class="btn oth" data-a="askbulk" data-v="${where}">✓ อนุมัติย้ายทั้งหมด (${n})</button>`;
};
// assets that already carry a QR sticker but were scanned as a barcode / typed: Admin confirms them in one go
const bulkQRBox = codes => {
  const n = codes.length;
  if (!n) return '';
  S.bulkQR = codes;
  return S.confirmBulk === 'qr'
    ? `<div class="confirm"><b>ยืนยันว่ามีสติกเกอร์ QR แล้วทั้งหมด ${n} รายการ?</b><span>รายการเหล่านี้จะออกจากคิวพิมพ์สติกเกอร์ · ใช้เมื่อสแกนจาก QR แต่ระบบบันทึกเป็นบาร์โค้ด</span><div class="row"><button class="btn pri" data-a="bulkqr">ยืนยัน ${n} รายการ</button><button class="btn" data-a="nobulk">ยกเลิก</button></div></div>`
    : `<button class="btn pri" data-a="askbulk" data-v="qr">✓ มีสติกเกอร์ QR แล้วทั้งหมด (${n})</button>`;
};
function webReport() {
  if (S.web === 'pivot') S.repTab = 'pv';
  else if (S.repTab === 'pv') S.repTab = 'dash';
  const tab = S.repTab || 'dash',
    d = reportData(tab === 'dash' || tab === 'files' ? 'sum' : tab),
    areas = (meta.areas || [])
      .filter(a => !a.shared)
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const n = Object.fromEntries(
    REP_TABS.filter(([k]) => !['pv', 'cr', 'dash', 'files'].includes(k)).map(([k]) => [
      k,
      k === tab ? d.rows.length : reportData(k).rows.length
    ])
  );
  let h = `<main class="wrap"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><p class="sub">${esc(meta.name)} · อัปเดตสด${meta.status === 'closed' ? '' : ' · ฉบับร่าง (ยังไม่ปิดรอบ)'}</p><h1>${S.web === 'pivot' ? '4.1 · Pivot Report' : '4.2 · รายงานสรุปผล'}</h1></div>
    <div class="row"><button class="btn" data-a="repdl" data-v="xlsx">⬇ Excel</button><button class="btn pri" data-a="repdl" data-v="pdf">⬇ PDF</button></div></div>
    <div class="row" style="justify-content:space-between;align-items:center"><div class="pills" ${tab === 'pv' ? 'hidden' : ''}>${REP_TABS.map(([k, l]) => `<button class="pill ${tab === k ? 'on' : ''}" data-a="reptab" data-v="${k}">${l}${['cr', 'pv', 'dash', 'files'].includes(k) ? '' : ` [${k === 'sum' ? Math.max(0, n[k] - 1) + ' CC' : N(n[k])}]`}</button>`).join('')}</div>
    ${tab === 'dash' || tab === 'pv' || tab === 'files' ? '' : `<select class="in" id="repCC" style="width:auto" aria-label="เลือก CC"><option value="">ทุก CC</option>${areas.map(a => `<option value="${esc(a.code)}" ${S.repCC === String(a.code) ? 'selected' : ''}>${esc(a.code)}${a.name !== String(a.code) ? ' · ' + esc(a.name) : ''}</option>`).join('')}</select>`}</div>
    ${tab === 'pv' ? `<section class="card" style="gap:8px"><span class="sub">ลากหัวข้อจากด้านซ้ายไปวางเป็นแถว (ซ้าย) หรือคอลัมน์ (บน) · เลือกวิธีคำนวณ เช่น จำนวน / ผลรวม · คลิก ▾ ที่หัวข้อเพื่อกรอง · ระบบจำรูปแบบไว้ให้ครั้งหน้า</span><div class="row"><button class="btn sm" data-a="pvreset">เริ่มใหม่</button></div><div id="pivotBox" class="pv-wrap"><p class="sub">กำลังโหลดเครื่องมือ Pivot…</p></div></section>` : ''}
    ${tab === 'cr' ? crPanel() : ''}${tab === 'mv' ? `<div class="row" style="justify-content:flex-end">${bulkMoveBox(S.repCC || '', 'rep')}</div>` : ''}
${tab === 'pv' ? '' : `    <section class="card"><h2>${esc(d.title)}${S.repCC ? ' · CC ' + esc(S.repCC) : ''} (${N(tab === 'sum' ? Math.max(0, d.rows.length - 1) : d.rows.length)})</h2><div class="tbl-wrap" style="max-height:66vh;overflow-y:auto"><table class="tfix"><colgroup>${d.w.map(x => `<col style="width:${x}%">`).join('')}</colgroup><thead><tr>${d.head.map((x, i) => `<th style="${(d.num || []).includes(i) || (tab === 'sum' && i === 9) ? 'text-align:right' : ''}">${esc(x)}</th>`).join('')}</tr></thead><tbody>`}`;
  if (tab === 'files') return h.replace(/<section class="card"><h2>[^]*$/, '') + webExport(cats(), true) + `</main>`;
  if (tab === 'dash')
    return (
      h.replace(/<section class="card"><h2>[^]*$/, '') +
      dashboard() +
      (S.msg.rep ? `<div class="msg ${S.msg.rep[1]}">${esc(S.msg.rep[0])}</div>` : '') +
      `</main>`
    );
  if (tab === 'pv')
    return h + (S.msg.rep ? `<div class="msg ${S.msg.rep[1]}">${esc(S.msg.rep[0])}</div>` : '') + `</main>`;
  for (const r of d.rows.slice(0, 1000)) {
    const tot = (tab === 'sum' || d.totRow) && r[0] === 'รวม';
    h += `<tr style="${tot ? 'font-weight:700;background:#f4f5fa' : ''}">${r.map((x, i) => `<td class="${i === 0 && tab !== 'sum' ? 'mono' : ''}" title="${esc(x)}" style="${(d.num || []).includes(i) || (tab === 'sum' && i === 9) ? 'text-align:right' : ''}">${esc(x)}</td>`).join('')}</tr>`;
  }
  h += `</tbody></table></div>${d.rows.length > 1000 ? `<p class="sub">แสดง 1,000 จาก ${N(d.rows.length)} · ไฟล์ที่ดาวน์โหลดมีครบ</p>` : ''}${d.rows.length ? '' : '<p class="sub">ไม่มีรายการ</p>'}</section>`;
  if (S.msg.rep) h += `<div class="msg ${S.msg.rep[1]}">${esc(S.msg.rep[0])}</div>`;
  return h + `</main>`;
}
async function reportFile(kind, fmt) {
  const d = reportData(kind),
    stamp = new Date().toLocaleString('th-TH'),
    name = `AssetSync-${d.title}${S.repCC ? '-CC' + S.repCC : ''}-${meta.name}`.replace(/[\\/:*?"<>|]/g, '_');
  const sub = `${meta.name}${S.repCC ? ' · CC ' + S.repCC : ''} · ${meta.status === 'closed' ? 'ปิดรอบแล้ว' : 'ฉบับร่าง'} · พิมพ์เมื่อ ${stamp}`;
  if (fmt === 'xlsx') {
    const ws = XLSX.utils.aoa_to_sheet([[d.title], [sub], [], d.head, ...d.rows]);
    ws['!cols'] = d.w.map(x => ({ wch: Math.max(8, Math.round(x * 1.4)) }));
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + d.rows.length, c: d.head.length - 1 } })
    };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, d.title.replace(/[:\\/?*\[\]]/g, ' ').slice(0, 31));
    return await save(
      name + '.xlsx',
      new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }
  // PDF: Thai needs the app font, so each A4 page is drawn on a canvas and placed as an image
  if (!window.jspdf) return ['โหลดตัวสร้าง PDF ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ', 'bad'];
  try {
    await document.fonts?.load('500 20px Prompt');
    await document.fonts?.load('700 20px Prompt');
  } catch {}
  const { jsPDF } = window.jspdf,
    pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
  const K = 4,
    W = 297 * K,
    H = 210 * K,
    M = 10 * K,
    rowH = 6.4 * K,
    fs = 2.7 * K,
    top0 = M + 16 * K,
    perPage = Math.floor((H - top0 - M - 6 * K) / rowH);
  const tw = d.w.reduce((a, b) => a + b, 0),
    cols = d.w.map(x => (x / tw) * (W - 2 * M)),
    cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d'),
    pages = Math.max(1, Math.ceil(d.rows.length / perPage));
  const cut = (t, w) => {
    let s2 = String(t ?? '');
    if (ctx.measureText(s2).width <= w) return s2;
    while (s2.length > 1 && ctx.measureText(s2 + '…').width > w) s2 = s2.slice(0, -1);
    return s2 + '…';
  };
  for (let pg = 0; pg < pages; pg++) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#121826';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${5 * K}px Prompt, sans-serif`;
    ctx.fillText(d.title, M, M + 3 * K);
    ctx.font = `400 ${2.6 * K}px Prompt, sans-serif`;
    ctx.fillStyle = '#667085';
    ctx.fillText(sub, M, M + 9 * K);
    ctx.textAlign = 'right';
    ctx.fillText(`หน้า ${pg + 1} / ${pages}`, W - M, M + 9 * K);
    ctx.textAlign = 'left';
    let y = top0;
    ctx.fillStyle = '#eef1fb';
    ctx.fillRect(M, y, W - 2 * M, rowH);
    ctx.fillStyle = '#121826';
    ctx.font = `600 ${fs}px Prompt, sans-serif`;
    let x = M;
    d.head.forEach((t, i) => {
      const right = (d.num || []).includes(i) || (kind === 'sum' && i === 9);
      ctx.textAlign = right ? 'right' : 'left';
      ctx.fillText(cut(t, cols[i] - 2 * K), right ? x + cols[i] - K : x + K, y + rowH / 2);
      x += cols[i];
    });
    ctx.textAlign = 'left';
    y += rowH;
    ctx.font = `400 ${fs}px Prompt, sans-serif`;
    for (const r of d.rows.slice(pg * perPage, (pg + 1) * perPage)) {
      const tot = (kind === 'sum' || d.totRow) && r[0] === 'รวม';
      if (tot) {
        ctx.fillStyle = '#f4f5fa';
        ctx.fillRect(M, y, W - 2 * M, rowH);
        ctx.font = `700 ${fs}px Prompt, sans-serif`;
      }
      ctx.fillStyle = '#121826';
      x = M;
      r.forEach((t, i) => {
        if (typeof t === 'number') t = t.toLocaleString('en-US', { maximumFractionDigits: 2 });
        const right = (d.num || []).includes(i) || (kind === 'sum' && i === 9);
        ctx.textAlign = right ? 'right' : 'left';
        ctx.fillText(cut(t, cols[i] - 2 * K), right ? x + cols[i] - K : x + K, y + rowH / 2);
        x += cols[i];
      });
      ctx.textAlign = 'left';
      ctx.strokeStyle = '#eaecf0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M, y + rowH);
      ctx.lineTo(W - M, y + rowH);
      ctx.stroke();
      y += rowH;
    }
    if (!d.rows.length) ctx.fillText('ไม่มีรายการ', M + K, y + rowH / 2);
    if (pg) pdf.addPage('a4', 'l');
    pdf.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  }
  return await save(name + '.pdf', pdf.output('blob'), 'application/pdf');
}
function totals() {
  const { cur } = compute();
  let total = 0,
    found = 0;
  for (const a of master.values()) {
    if (!counted(a)) continue;
    total++;
    if (cur.has(a.code)) found++;
  }
  let other = 0,
    unk = 0,
    borrow = 0;
  for (const s of cur.values()) {
    if (isMoveCase(s)) other++;
    if (isBorrowed(s)) borrow++;
    if (!master.has(s.code)) unk++;
  }
  return { total, found, left: total - found, other, unk, borrow };
}
