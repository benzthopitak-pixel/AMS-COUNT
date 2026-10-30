/* AssetSync · ไฟล์ส่งออก Excel: ผลตรวจนับตามแม่แบบบริษัท, Transfer (AS02), Write-off (ABAVN), สติกเกอร์ OGA */
const toCell = v =>
  typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !/^-?0\d/.test(v) && v.length < 16 ? Number(v) : v;
function exportBook(kind) {
  const { cur } = compute(),
    wb = XLSX.utils.book_new(),
    h = meta.headers || [],
    t = meta.tpl || {},
    m0 = meta.map || {
      code: Math.max(
        0,
        h.findIndex(x => norm(x) === 'ASSET')
      ),
      name: -1
    },
    draft = meta.status !== 'closed',
    wo = meta.leftChoice !== 'recount';
  const dataSheetName =
    String(meta.sheet || 'ผลนับ')
      .replace(/[\\/?*\[\]:]/g, ' ')
      .slice(0, 31) === 'สรุป'
      ? 'ข้อมูล'
      : String(meta.sheet || 'ผลนับ')
          .replace(/[\\/?*\[\]:]/g, ' ')
          .slice(0, 31);
  const serial = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
  };
  const fixDates = (ws, fmtOf) => {
    for (const k in ws) {
      if (k[0] === '!') continue;
      const c = ws[k];
      if (c.t === 's' && ISO_DATE.test(c.v)) {
        const col = XLSX.utils.decode_cell(k).c,
          f = fmtOf ? fmtOf(col) : '';
        c.t = 'n';
        c.v = serial(c.v);
        c.z = f && f.startsWith('date:') ? f.slice(5) : 'dd/mm/yyyy';
      }
    }
  };
  const addData = (name, rows, nSrc) => {
    const ws = XLSX.utils.aoa_to_sheet(rows),
      fm = meta.colFmts || [],
      wd = meta.colWidths || [];
    fixDates(ws, col => fm[col] || '');
    for (const k in ws) {
      if (k[0] === '!') continue;
      const a = XLSX.utils.decode_cell(k);
      if (a.r > 0 && a.c < nSrc && ws[k].t === 'n' && fm[a.c] && !fm[a.c].startsWith('date:')) ws[k].z = fm[a.c];
    }
    ws['!cols'] = rows[0].map((_, i) => ({ wch: i < nSrc ? wd[i] || 14 : i === nSrc ? 16 : 14 }));
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } })
    };
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };
  const add = (name, rows, wide) => {
    const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.map(toCell)));
    fixDates(ws);
    ws['!cols'] = (rows.find(r => r.length > 3) || rows[0] || []).map((_, i) => ({ wch: wide?.includes(i) ? 38 : 14 }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };
  const ix = re => h.findIndex(x => re.test(norm(x)));
  const ci = { cap: ix(/CAPITALIZED/), acq: ix(/ACQUIS|CUM\.ACQ/), dep: ix(/ACCUM/), book: ix(/BOOK VAL|END BOOK/) };
  const sumIdx = (a, i) =>
    i < 0 ? '' : Math.round(a.raws.reduce((n, r) => n + (Number(String(r[i]).replace(/,/g, '')) || 0), 0) * 100) / 100;
  const moved = [...cur.values()].filter(s => master.has(s.code) && isMoved(s));
  const left = [...master.values()].filter(a => counted(a) && !cur.has(a.code));
  if (kind === 'main' || kind === 'summary') {
    const by = new Map();
    for (const a of master.values()) {
      if (!counted(a)) continue;
      const s = cur.get(a.code),
        e = by.get(a.cc) || { code: a.cc, total: 0, found: 0, moved: 0, dmg: 0, re: 0 };
      e.total++;
      if (s) {
        e.found++;
        if (isMoved(s)) e.moved++;
        if (s.cond !== 'ปกติ') e.dmg++;
        if (s.flags.reprint || s.flags.namebad) e.re++;
      }
      by.set(a.cc, e);
    }
    const sum = [
      [`สรุปผลตรวจนับ · ${meta.name}${draft ? ' · ฉบับร่าง' : ''}`],
      [],
      [
        'Cost Center',
        'Department',
        'รหัสที่ต้องนับ',
        'นับพบ',
        'ยังไม่พบ',
        'ย้ายแผนก',
        'ชำรุด / รอซ่อม / ไม่ใช้งาน',
        'ต้องพิมพ์ป้ายใหม่',
        '% นับพบ',
        'ปิดงานนับ'
      ]
    ];
    for (const [k, e] of [...by].sort((x, y) => String(x[1].code).localeCompare(String(y[1].code))))
      sum.push([
        e.code,
        ccNameOf(k),
        e.total,
        e.found,
        e.total - e.found,
        e.moved,
        e.dmg,
        e.re,
        e.total ? Math.round((e.found / e.total) * 1000) / 10 + '%' : '0%',
        ccClosed(k) ? `${ccClosed(k).by} · ${fmtT(ccClosed(k).t)}` : 'ยังไม่ปิด'
      ]);
    sum.push(
      [],
      ['ไม่อยู่ในทะเบียน', [...cur.values()].filter(s => !master.has(s.code)).length],
      ['ไม่นับ (Write-Off เดิม)', meta.woCount || 0],
      ['ส่งออกเมื่อ', new Date().toLocaleString('th-TH')]
    );
    add('สรุป', sum, [1]);
  }
  if (kind === 'main') {
    const tplCols = [
      'sticker',
      'nosticker',
      'note',
      'status',
      'ccNew',
      'ccNewName',
      'chk',
      'stA',
      'scanDate',
      'cntCC',
      'cntLoc',
      'rmk',
      'notPlan'
    ].some(k => t[k] >= 0);
    const dt = ms => {
      const d = new Date(ms);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const fillSY = (r, s, unk) => {
      const L = !s && r[m0.code] ? lostOf(norm(r[m0.code])) : null;
      if (t.chk >= 0)
        r[t.chk] = s
          ? isBorrowed(s)
            ? 'Found (borrowed)'
            : isOther(s)
              ? 'Found (other CC)'
              : 'Found'
          : L
            ? 'Lost'
            : 'Not Found';
      if (t.stA >= 0) r[t.stA] = s ? s.cond : '';
      if (t.scanDate >= 0) r[t.scanDate] = s ? dt(s.t) : '';
      if (t.cntCC >= 0) r[t.cntCC] = s ? String(s.area) : '';
      if (t.cntLoc >= 0)
        r[t.cntLoc] = s ? [s.areaName !== String(s.area) ? s.areaName : '', s.room].filter(Boolean).join(' · ') : '';
      if (t.rmk >= 0) r[t.rmk] = s ? s.remark : L ? L.remark : '';
      if (t.scanDate >= 0 && L) r[t.scanDate] = dt(L.t);
      if (t.notPlan >= 0) r[t.notPlan] = unk ? 'Y' : '';
    };
    const extra = [
      'ผลการนับ',
      'พื้นที่ที่พบ',
      'ห้อง / Location',
      'สภาพ',
      'ต้องพิมพ์สติกเกอร์ใหม่',
      'ชื่อบนสติกเกอร์ไม่ตรงระบบ',
      'สถานะโอนย้าย',
      'Remark',
      'ผู้นับ',
      'เวลานับ',
      'เครื่อง',
      'วิธีตรวจนับ',
      'QR'
    ];
    const data = [[...h, ...extra]];
    for (const a of master.values()) {
      const s = cur.get(a.code),
        mv = s && isMoved(s);
      for (const raw of a.raws.length ? a.raws : [[]]) {
        const r = [...raw];
        while (r.length < h.length) r.push('');
        if (a.wo) {
          data.push([...r, 'ตัดจำหน่ายแล้ว (ไม่นับ)']);
          continue;
        }
        if (tplCols) {
          if (t.sticker >= 0) r[t.sticker] = s && !s.ns ? 'CHECK' : '';
          if (t.nosticker >= 0) r[t.nosticker] = s && s.ns ? 'CHECK' : '';
          if (t.note >= 0)
            r[t.note] = s ? [s.room, s.cond !== 'ปกติ' ? s.cond : '', s.remark].filter(Boolean).join(' · ') : 'ไม่พบ';
          if (t.status >= 0)
            r[t.status] = !s ? (wo ? 'Write - Off' : 'ไม่พบ (นับซ้ำ)') : mv ? 'เปลี่ยน Cost center' : 'CC เดิม';
          if (t.ccNew >= 0) r[t.ccNew] = s ? (mv ? s.area : a.cc) : '';
          if (t.ccNewName >= 0) r[t.ccNewName] = s ? (mv ? s.areaName : a.ccName) : '';
          fillSY(r, s, false);
        }
        data.push([
          ...r,
          !s ? (lostOf(a.code) ? 'สูญหาย' : 'ไม่พบ') : mv ? 'พบ (ย้ายแผนก)' : isOther(s) ? 'พบ (ยืมมา)' : 'พบ',
          s ? (s.shared || String(s.area) === String(s.areaName) ? s.areaName : `${s.area} ${s.areaName}`) : '',
          s?.room || '',
          s?.cond || '',
          s?.flags.reprint ? 'Y' : '',
          s?.flags.namebad ? 'Y' : '',
          s?.flags.pendingTransfer ? 'รอโอนย้าย' : '',
          s?.remark || '',
          s?.by || '',
          s ? fmtT(s.t) : '',
          s?.dev || '',
          s ? SRC[s.src][0] : '',
          !s ? '' : hasQR(s) ? 'ครบ' : s.printedAt ? 'ติดแล้ว' : 'ต้องสร้าง QR'
        ]);
      }
    }
    // scanned but not in the register: one row each at the bottom, marked 'Asset Not In Plan'
    if (t.notPlan >= 0)
      for (const s of cur.values()) {
        if (master.has(s.code)) continue;
        const r = h.map(() => '');
        r[m0.code] = s.code;
        if (m0.name >= 0) r[m0.name] = s.uname || '';
        fillSY(r, s, true);
        data.push(r);
      }
    addData(dataSheetName, data, h.length);
  }
  if (kind === 'main' || kind === 'transfer') {
    add(
      'Transfer Sheet',
      [
        ['Status', 'เปลี่ยน Cost center', '', 'T-Code :  AS02'],
        [],
        ['Cost Center', 'Department', 'Asset', 'Sub-number', 'Description', 'CC ( New )', 'CC Name2', 'สถานะ']
      ].concat(
        moved.map(s => {
          const a = master.get(s.code);
          return [
            a.cc,
            a.ccName,
            a.asset,
            a.sub === '' ? '(blank)' : a.sub,
            a.name,
            s.area,
            s.areaName,
            s.rv.move === 'approved' ? 'รอโอนย้าย' : 'รออนุมัติ'
          ];
        })
      ),
      [4]
    );
  }
  if (kind === 'main' || kind === 'writeoff') {
    const rows = left
      .sort((x, y) => String(x.cc).localeCompare(String(y.cc)) || x.code.localeCompare(y.code))
      .map(a => [
        a.cc,
        a.ccName,
        a.asset,
        a.sub === '' ? '(blank)' : a.sub,
        a.name,
        a.raws[0] && ci.cap >= 0 ? a.raws[0][ci.cap] : '',
        sumIdx(a, ci.acq),
        sumIdx(a, ci.dep),
        sumIdx(a, ci.book)
      ]);
    add(
      'write-off',
      [
        ['Status', wo ? 'Write - Off' : 'ไม่พบ (รอนับซ้ำ)', '', '', 'T-Code : ABAVN'],
        [],
        [
          'Cost Center',
          'Department',
          'Asset',
          'Sub-number',
          'Description',
          'Capitalized on',
          'Acquis.val.',
          'Accum.dep.',
          'Book val.'
        ]
      ].concat(rows),
      [4]
    );
    const g = new Map();
    for (const r of rows) {
      const e = g.get(r[0]) || [r[0], r[1], 0, 0, 0, 0];
      e[2]++;
      e[3] += +r[6] || 0;
      e[4] += +r[7] || 0;
      e[5] += +r[8] || 0;
      g.set(r[0], e);
    }
    for (const e of g.values()) for (const i of [3, 4, 5]) e[i] = Math.round(e[i] * 100) / 100;
    add(
      'สรุป write-off',
      [
        [],
        ['สรุป ขออนุมัติ Write - Off'],
        ['Cost Center', 'Department', 'List', 'Asset Cost', 'Accum.dep._Net', ' Book value_Net', 'Status', 'Remark']
      ].concat([...g.values()].map(e => [...e, 'Loss', 'ขออนุมัติ write - off'])),
      [1]
    );
  }
  if (kind === 'main') {
    add(
      'คิวพิมพ์สติกเกอร์',
      [['No.', 'Date', 'CC', 'HO (แผนก)', 'ชื่อ', 'เหตุผล']].concat(
        [...cur.values()]
          .filter(
            s =>
              master.has(s.code) && (s.flags.reprint || s.flags.namebad || s.ns || oldQR(s) || s.rv.move === 'approved')
          )
          .map(s => {
            const a = master.get(s.code),
              cc = labelCC(s.code);
            return [
              s.code,
              capDate(a),
              cc.code,
              cc.name,
              a.name,
              [
                s.flags.reprint && 'ต้องพิมพ์ใหม่',
                s.flags.namebad && 'ชื่อไม่ตรง',
                s.ns && 'ไม่มีสติกเกอร์',
                oldQR(s) && 'QR รูปแบบเก่า',
                s.rv.move === 'approved' && 'ย้ายแผนก'
              ]
                .filter(Boolean)
                .join(' · ')
            ];
          })
      ),
      [4]
    );
    add(
      'ไม่อยู่ในทะเบียน',
      [['รหัสที่สแกน', 'ชื่อ (ผู้ตรวจนับกรอก)', 'พื้นที่ที่พบ', 'ห้อง', 'ผลตรวจ Admin', 'ผู้นับ', 'เวลานับ']].concat(
        [...cur.values()]
          .filter(s => !master.has(s.code))
          .map(s => [
            s.code,
            s.uname,
            s.areaName,
            s.room,
            { accepted: 'รับเข้าทะเบียน', rejected: 'ไม่ใช่ทรัพย์สินของบริษัท' }[s.rv.unk] || 'รอตรวจ',
            s.by,
            fmtT(s.t)
          ])
      ),
      [1]
    );
  }
  if (wb.SheetNames.includes(dataSheetName))
    wb.SheetNames = [dataSheetName, ...wb.SheetNames.filter(n => n !== dataSheetName)];
  return wb;
}
async function exportFile(kind) {
  if (!meta || !master.size) return ['ยังไม่มีทะเบียน', 'bad'];
  try {
    const wb = exportBook(kind),
      data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const nm = { main: 'ผลตรวจนับ', transfer: 'Transfer-AS02', writeoff: 'WriteOff-ABAVN' }[kind];
    return await save(
      `AssetSync-${nm}${meta.status === 'closed' ? '' : '-ฉบับร่าง'}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      new Uint8Array(data),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  } catch (e) {
    return ['สร้างไฟล์ไม่สำเร็จ: ' + e.message, 'bad'];
  }
}
// sticker list in the company template (OGA_Templete_AMSCounting_Review): one row per sub-number, same 18 headers, colours and widths
const OGA = [
  ['Asset ', 'FFFF00', 9.25],
  ['Inventory No.', '92D050', 11.375],
  ['Serial Number', '92D050', 10.625],
  ['Asset Class', '92D050', 22.25],
  ['Life (year)', '92D050', 9.375],
  ['Description', 'FFFF00', 44],
  ['Plant', '92D050', 4.25],
  ['Plant name', '92D050', 8.25],
  ['Cost Center', 'FFFF00', 10],
  ['Cost Center name', '92D050', 14.75],
  ['Capitalized on', 'FFFF00', 11.625],
  ['Location', 'FFFF00', 12.125],
  ['Vendor', '92D050', 8.125],
  ['Asset Owner', '9BC2E6', 9],
  ['      Acquis.val.', '92D050', 10.125],
  ['        Accum.dep.', '92D050', 11.5],
  ['      Book val.', '92D050', 9.125],
  ['Crcy', '92D050', 3.75]
];
async function stickerExcel(codes) {
  const X = window.XLSXS;
  if (!X) return ['โหลดตัวสร้าง Excel ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ', 'bad'];
  const H = meta.headers || [],
    m0 = meta.map || {},
    col = (...re) => {
      for (const r of re) {
        const i = H.findIndex(h => r.test(norm(h)));
        if (i >= 0) return i;
      }
      return -1;
    };
  const ix = {
    sub: col(/^SUB-?NUMBER$|^SUBNUMBER$|^SUB\.?NO/, /^SERIAL NUMBER$/),
    inv: col(/^INVENTORY/),
    cls: col(/^ASSET CLASS$|^CLASS$/),
    life: col(/^LIFE/),
    plant: col(/^PLANT$/),
    plantName: col(/^PLANT NAME$/),
    cap: col(/CAPITALIZED/),
    loc: col(/^LOCATION$/),
    vendor: col(/^VENDOR$/),
    owner: col(/^ASSET OWNER$/),
    acq: col(/ACQUIS|CUM\.ACQ/),
    dep: col(/^ACCUM/),
    book: col(/BOOK VAL|END BOOK/),
    crcy: col(/^CRCY$|^CURRENCY$/)
  };
  const v = (raw, i) => (i >= 0 ? (raw[i] ?? '') : '');
  const border = {
    top: { style: 'thin', color: { rgb: 'BFBFBF' } },
    bottom: { style: 'thin', color: { rgb: 'BFBFBF' } },
    left: { style: 'thin', color: { rgb: 'BFBFBF' } },
    right: { style: 'thin', color: { rgb: 'BFBFBF' } }
  };
  const ws = {},
    put = (r, c, cell) => {
      ws[X.utils.encode_cell({ r, c })] = cell;
    };
  OGA.forEach(([h, fill], c) =>
    put(0, c, {
      t: 's',
      v: h,
      s: {
        font: { name: 'Tahoma', sz: 9, bold: true },
        fill: { patternType: 'solid', fgColor: { rgb: fill } },
        alignment: { horizontal: c > 1 && c !== 5 && c !== 8 && c !== 9 ? 'center' : undefined, vertical: 'center' }
      }
    })
  );
  let r = 1;
  for (const code of codes) {
    const a = master.get(code);
    if (!a) continue;
    const cc = labelCC(code);
    for (const raw of a.raws.length ? a.raws : [[]]) {
      const sub = String(v(raw, ix.sub) || 0).replace(/\.0+$/, ''),
        cap = String(v(raw, ix.cap) || '');
      const vals = [
        `${a.asset}-${a.sub !== '' ? a.sub : subKey(sub) || '0'}`,
        v(raw, ix.inv),
        sub,
        v(raw, ix.cls),
        v(raw, ix.life),
        v(raw, m0.name ?? -1) || a.name,
        v(raw, ix.plant),
        v(raw, ix.plantName),
        cc.code,
        cc.name,
        cap,
        v(raw, ix.loc),
        v(raw, ix.vendor),
        v(raw, ix.owner),
        v(raw, ix.acq),
        v(raw, ix.dep),
        v(raw, ix.book),
        v(raw, ix.crcy)
      ];
      vals.forEach((x, c) => {
        const base = {
          font: { name: 'Tahoma', sz: 9 },
          border,
          alignment: { horizontal: [2, 4, 6, 10].includes(c) ? 'center' : undefined, vertical: 'center' }
        };
        if (c === 10 && /^\d{4}-\d{2}-\d{2}$/.test(cap)) {
          const [y, mo, d] = cap.split('-').map(Number);
          put(r, c, { t: 'n', v: (Date.UTC(y, mo - 1, d) - Date.UTC(1899, 11, 30)) / 864e5, z: 'mm-dd-yy', s: base });
          return;
        }
        if (c >= 14 && c <= 16 && x !== '' && !isNaN(Number(x))) {
          put(r, c, { t: 'n', v: Number(x), z: '#,##0.00', s: base });
          return;
        }
        put(r, c, { t: 's', v: String(x ?? ''), z: '@', s: base });
      });
      r++;
    }
  }
  ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, r - 1), c: OGA.length - 1 } });
  ws['!cols'] = OGA.map(([, , w]) => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!views'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sheet1');
  const d = new Date(),
    stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return await save(
    `OGA_AMSCounting_Review-สติกเกอร์-${r - 1}แถว-${stamp}.xlsx`,
    new Uint8Array(X.write(wb, { bookType: 'xlsx', type: 'array' })),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}
