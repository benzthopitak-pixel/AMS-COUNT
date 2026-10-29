/* AssetSync · เมนู 1 เพิ่มข้อมูลตรวจนับ: รายการงาน, นำเข้าไฟล์ Excel ทะเบียน (เดาคอลัมน์, Sub-number, สรุปก่อนนำเข้า) */
function guess(headers, words, rows) {
  const skip = h => /^COUNT |NAME/.test(norm(h)) && !words.some(w => w.includes('NAME')); // 'Count Cost Center' is an answer column, not the register
  const hits = [];
  for (const w of words)
    headers.forEach((h, i) => {
      if (norm(h).includes(w) && !hits.includes(i) && !skip(h)) hits.push(i);
    });
  if (rows) {
    const f = hits.find(i => rows.filter(r => String(r[i] ?? '').trim()).length >= rows.length / 2);
    if (f !== undefined) return f;
  }
  return hits.length ? hits[0] : -1;
}
function detectTpl(h) {
  const find = f => h.findIndex(f),
    ccNew = find(x => norm(x).replace(/\s/g, '').includes('CC(NEW)'));
  return {
    sticker: find(x => x.includes('ติดสติ') && !x.includes('ยังไม่')),
    nosticker: find(x => x.includes('ยังไม่ติด')),
    note: find(x => x.includes('หมายเหตุ')),
    status: find(x => norm(x) === 'STATUS'),
    chk: find(x => norm(x) === 'STATUS CHECK'),
    stA: find(x => norm(x) === 'STATUS ASSET'),
    scanDate: find(x => norm(x) === 'SCAN DATE'),
    cntCC: find(x => norm(x) === 'COUNT COST CENTER'),
    cntLoc: find(x => norm(x) === 'COUNT LOCATION'),
    rmk: find(x => norm(x) === 'REMARK'),
    notPlan: find(x => norm(x) === 'ASSET NOT IN PLAN'),
    ccNew,
    ccNewName: ccNew >= 0 && ccNew + 1 < h.length ? ccNew + 1 : -1
  };
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const cellStr = v => (typeof v === 'string' ? v.trim() : v == null ? '' : v); // numbers stay numbers, dates arrive as yyyy-mm-dd
const filled = c => c !== '' && c != null;
function readSheet(buf, name) {
  const wb = XLSX.read(buf, {
      type: 'array',
      codepage: 874,
      cellDates: false,
      cellNF: true,
      cellStyles: true,
      sheets: name
    }),
    ws = wb.Sheets[name];
  if (ws['!ref']) {
    const r = XLSX.utils.decode_range(ws['!ref']);
    if (r.e.r > 60000) r.e.r = 60000;
    if (r.e.c > 120) r.e.c = 120;
    ws['!ref'] = XLSX.utils.encode_range(r);
  }
  // dates: read the calendar day exactly as Excel stores it (no time-zone shift)
  for (const k in ws) {
    if (k[0] === '!') continue;
    const c = ws[k];
    if (c && c.t === 'n' && c.z && XLSX.SSF.is_date(c.z)) {
      const d = XLSX.SSF.parse_date_code(c.v);
      if (d) {
        c.t = 's';
        c.v = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        c.isDate = true;
      }
    } else if (c && c.t === 'd' && c.v instanceof Date) {
      c.t = 's';
      c.v = c.v.toISOString().slice(0, 10);
    }
  }
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).map(r => r.map(cellStr));
  const hi = Math.max(
    0,
    rows.slice(0, 15).findIndex(r => r.some(c => norm(c) === 'ASSET'))
  );
  rows = rows.slice(hi).filter(r => r.some(filled));
  if (rows.length < 2) return null;
  const width = Math.max(...rows.map(r => r.length)),
    keep = [];
  for (let i = 0; i < width; i++) if (rows.some(r => filled(r[i]))) keep.push(i);
  // remember how the source file shows each column (number format, width) so the export looks the same
  const fmts = keep.map(i => {
    for (let r = range.s.r + hi + 1; r <= Math.min(range.e.r, range.s.r + hi + 40); r++) {
      const c = ws[XLSX.utils.encode_cell({ r, c: range.s.c + i })];
      if (c && filled(c.v))
        return c.isDate ? 'date:' + (c.z || 'dd/mm/yyyy') : c.t === 'n' && c.z && c.z !== 'General' ? c.z : '';
    }
    return '';
  });
  const widths = keep.map(
    i =>
      (ws['!cols'] &&
        ws['!cols'][range.s.c + i] &&
        (ws['!cols'][range.s.c + i].wch || ws['!cols'][range.s.c + i].width)) ||
      0
  );
  rows = rows.map(r => keep.map(i => r[i] ?? ''));
  return { headers: rows[0].map((h, i) => String(h || 'คอลัมน์ ' + (i + 1))), rows: rows.slice(1), fmts, widths };
}
function prepareImport(name) {
  const p = readSheet(S.imp.buf, name);
  if (!p) {
    S.imp.err = 'ชีตนี้ไม่มีข้อมูลทะเบียน';
    return;
  }
  const h = p.headers,
    b = p.rows,
    ex = h.findIndex(x => norm(x) === 'ASSET');
  Object.assign(S.imp, {
    sheet: name,
    headers: h,
    rows: b,
    fmts: p.fmts,
    widths: p.widths,
    err: null,
    tpl: detectTpl(h),
    map: {
      code: ex >= 0 ? ex : Math.max(0, guess(h, ['ASSET', 'รหัส', 'CODE'])),
      alt: guess(h, ['INVENTORY'], b),
      name: guess(h, ['DESC', 'ชื่อ', 'รายการ', 'NAME']),
      ccName: guess(h, ['CC NAME', 'COST CENTER NAME', 'แผนก'], b),
      cc: guess(
        h,
        ['COST CTR', 'COST CENTER', 'COST CETER', 'COST CENTRE'].concat(h.some(x => norm(x) === 'CC') ? ['CC'] : []),
        b
      ),
      cls: guess(h, ['ASSET CLASS', 'CLASS']),
      sub: subCol(h)
    }
  });
}
// SAP: "Subnumber", "Sub-number", "SNo." · a column called just "Sub" too
function subCol(h) {
  const n = x => norm(x).replace(/[\s._-]/g, '');
  return h.findIndex(x => ['SUBNUMBER', 'SUBNO', 'SNO', 'SUB', 'ASSETSUBNUMBER'].includes(n(x)));
}
const impKey = (r, m) => {
  const c = norm(r[m.code]);
  return !c ? '' : m.sub >= 0 ? keyOf(c, subKey(r[m.sub]) || '0') : c;
};
function importStats() {
  const I = S.imp,
    m = I.map,
    codes = new Map();
  let wo = 0;
  const assets = new Map();
  for (const r of I.rows) {
    const c = impKey(r, m);
    if (!c) continue;
    codes.set(c, (codes.get(c) || 0) + 1);
    const as = norm(r[m.code]);
    assets.set(as, (assets.get(as) || new Set()).add(c));
    if (I.tpl.status >= 0 && r[I.tpl.status] === 'Write - Off') wo++;
  }
  const rep = [...codes.values()].filter(v => v > 1);
  return {
    codes: codes.size,
    rows: I.rows.length,
    multi: rep.length,
    multiRows: rep.reduce((a, b) => a + b, 0),
    wo,
    withSubs: m.sub >= 0 ? [...assets.values()].filter(x => x.size > 1).length : 0
  };
}
async function doImport() {
  const I = S.imp,
    m = I.map,
    g = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  const out = new Map(),
    cc = {},
    nmSeen = {},
    statusIx = I.tpl.status;
  for (const r of I.rows) {
    const code = impKey(r, m);
    if (!code) continue;
    const asset = norm(r[m.code]),
      sub = m.sub >= 0 ? subKey(r[m.sub]) || '0' : '';
    const wo = statusIx >= 0 && r[statusIx] === 'Write - Off';
    const ccCode = ccKey(g(r, m.cc)),
      ccNm = g(r, m.ccName) || ccCode; // no department-name column: the Cost Center code is the department
    if (ccCode && !cc[ccCode]) cc[ccCode] = ccNm;
    if (ccCode) (nmSeen[ccCode] = nmSeen[ccCode] || new Set()).add(ccNm);
    const ex = out.get(code);
    if (ex) {
      ex[5].push(r);
      continue;
    }
    out.set(code, [
      code,
      g(r, m.name),
      ccNm,
      g(r, m.cls),
      m.alt >= 0 ? norm(r[m.alt]) : '',
      [r],
      ccCode,
      wo,
      asset,
      sub
    ]);
  }
  const rows = [...out.values()],
    counts = {};
  for (const r of rows) if (!r[7]) counts[r[6]] = (counts[r[6]] || 0) + 1;
  const fresh = true;
  if (fresh) {
    const nm =
      ($('#impRound')?.value || I.roundName || '').trim() || 'ตรวจนับ ' + new Date().toLocaleDateString('th-TH');
    const id = 'r' + Date.now();
    if (meta && (!jobs || !jobs.length)) jobs = [jobEntry(meta)];
    meta = {
      id,
      name: nm,
      status: 'counting',
      createdAt: Date.now(),
      releasedAt: Date.now(),
      team: meta?.team || [],
      areas: [],
      metaKey: 'meta/' + id,
      masterKey: 'master/' + id + '/c'
    };
    jobId = id;
    LS.set('jobId', id);
    watchedKey = null;
    loadMine();
    evRound = null;
    S.cards = [];
    S.liveArea = null;
  }
  const prev = new Map((meta.areas || []).map(a => [String(a.code), a]));
  const areas = Object.entries(cc)
    .filter(([k]) => k)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => ({
      code,
      name,
      count: counts[code] || 0,
      assignee: prev.get(code)?.assignee || null,
      shared: false
    }));
  for (const a of meta.areas || []) if (a.shared) areas.push(a);
  const woCount = rows.filter(r => r[7]).length;
  const ccNames = Object.fromEntries(
    Object.entries(nmSeen)
      .filter(([, v]) => v.size > 1)
      .map(([k, v]) => [k, [...v]])
  );
  S.imp = null;
  flash('กำลังนำเข้า…');
  await saveMaster(rows, {
    ...meta,
    fileName: I.fileName,
    sheet: I.sheet,
    headers: I.headers,
    colFmts: I.fmts,
    colWidths: I.widths,
    tpl: I.tpl,
    map: m,
    areas,
    woCount,
    ccNames,
    total: rows.filter(r => !r[7]).length
  });
  if (db) watchJob();
  if (fresh) subscribeEvents();
  S.web = 'live';
  flash(
    `นำเข้าแล้ว ${N(rows.length)} รายการ · ${areas.length} แผนก${Object.keys(ccNames).length ? ` · ⚠ ชื่อแผนกไม่ตรงกัน ${Object.keys(ccNames).length} CC (ยึดรหัส CC)` : ''}`
  );
}
function webRounds(c) {
  let h = `<main class="wrap"><div><p class="sub">แต่ละไฟล์ที่นำเข้า = 1 งาน · มีหลายงานพร้อมกันได้</p><h1>1 · เพิ่มข้อมูลตรวจนับ</h1></div>`;
  const list = jobList();
  if (list.length && !S.imp) {
    h += `<section class="card"><h2>งานทั้งหมด (${list.length})</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">`;
    for (const j of list) {
      const cur = meta && j.id === meta.id,
        T = cur ? totals() : null,
        pct = T && T.total ? Math.round((T.found / T.total) * 100) : 0;
      h += `<div class="card" style="border:2px solid ${cur ? 'var(--blue)' : 'var(--line)'};gap:6px">
        <div class="row" style="justify-content:space-between;align-items:center"><span class="chip ${j.status === 'closed' ? 'c-gray' : 'c-warn'}">${j.status === 'closed' ? 'ปิดแล้ว' : 'กำลังนับ'}</span>${cur ? '<span class="chip c-blue">เปิดอยู่</span>' : ''}</div>
        <b style="font-size:18px">${esc(j.name)}</b><span class="sub">${esc(j.fileName || '-')} · ${j.total != null ? N(j.total) + ' รายการ · ' : ''}${j.areas} CC · ${j.createdAt ? fmtT(j.createdAt) : ''}</span>
        ${cur ? `<div class="bar" aria-label="นับพบ ${pct}%"><i style="width:${pct}%;background:var(--ok)"></i></div><span class="sub"><b style="color:var(--ok-ink)">${pct}%</b> · ${N(T.found)}/${N(T.total)} · เรื่องรอตรวจ ${c ? c.move.length + c.unk.length + c.dmg.length : 0}</span>` : ''}
        <div class="row" style="gap:6px">${cur ? `<button class="btn sm pri" data-a="web" data-v="live">ไปหน้านับ →</button>` : `<button class="btn sm pri" data-a="pickjob" data-v="${esc(j.id)}">เปิดงานนี้</button>`}
        ${S.confirmDel === j.id ? `<button class="btn sm red" data-a="deljob" data-v="${esc(j.id)}">ยืนยันลบ (ผลนับหายด้วย)</button><button class="btn sm" data-a="nodel">ยกเลิก</button>` : `<button class="btn sm" data-a="askdel" data-v="${esc(j.id)}">ลบ</button>`}</div></div>`;
    }
    h += `</div></section>`;
  }
  h += `<section class="card"><h2>${list.length ? 'เพิ่มงานใหม่' : 'เริ่มงานแรก'}</h2>${importBlock()}</section>`;
  return h + `</main>`;
}
function importBlock() {
  const busyRound = meta && meta.status === 'counting';
  if (!S.imp)
    return `<div class="drop" data-drop="master"><b style="font-size:18px">ลากไฟล์ Excel มาวางตรงนี้</b><span class="sub">.xlsx .xls .csv</span><button class="btn pri" data-a="pick" data-v="master">เลือกไฟล์</button></div>`;
  const I = S.imp,
    opts = sel =>
      `<option value="-1">— ไม่ใช้ —</option>` +
      I.headers.map((x, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
  let h = `<div class="row" style="justify-content:space-between;align-items:center"><span>ชื่อไฟล์: <b>${esc(I.fileName)}</b></span><label class="f" style="flex-direction:row;align-items:center;gap:8px">ชีต <select class="in" id="impSheet" style="width:auto">${I.names.map(n => `<option ${n === I.sheet ? 'selected' : ''}>${esc(n)}${I.hidden.has(n) ? ' (ซ่อน)' : ''}</option>`).join('')}</select></label></div>`;
  if (I.err)
    return (
      h +
      `<div class="msg bad">${esc(I.err)}</div><div class="row"><button class="btn" data-a="cancelimport">เลือกไฟล์ใหม่</button></div>`
    );
  const st = importStats(),
    fresh = true;
  if (fresh)
    h += `<label class="f">ชื่อรอบตรวจนับ<input class="in" id="impRound" value="${esc(I.roundName)}" maxlength="80"></label>`;
  h += `<div class="grid">${[
    ['code', 'เลข Asset (บนสติกเกอร์) *'],
    ['name', 'ชื่อทรัพย์สิน'],
    ['cc', 'รหัส Cost Center'],
    ['ccName', 'ชื่อแผนก (Cost Center)'],
    ['sub', 'Sub-number (เลขซับ)'],
    ['alt', 'รหัสสำรอง'],
    ['cls', 'ประเภท']
  ]
    .map(([k, l]) => `<label class="f">${l}<select class="in" data-map="${k}">${opts(I.map[k] ?? -1)}</select></label>`)
    .join('')}</div>
    <div class="chips"><span class="chip c-ok">✓ ${N(st.codes)} รายการ จาก ${N(st.rows)} แถว</span>${I.map.sub >= 0 ? `<span class="chip c-blue">แยกตาม Asset + Sub-number${st.withSubs ? ` · ${N(st.withSubs)} Asset มีหลายรายการย่อย` : ''}</span>` : `<span class="chip c-gray">ไม่ได้เลือกคอลัมน์ Sub-number · นับรวมตามเลข Asset</span>`}${st.multi ? `<span class="chip c-warn">${I.map.sub >= 0 ? 'Asset + Sub' : 'เลข Asset'} ซ้ำในไฟล์ ${st.multi} เลข (รวม ${N(st.multiRows)} แถว) · สแกนครั้งเดียวนับครบทุกแถว</span>` : ''}${st.wo ? `<span class="chip c-warn">${st.wo} แถว Write-Off เดิม · ไม่นับ</span>` : ''}</div>`;
  if (busyRound)
    h += `<div class="msg ok">ไฟล์นี้จะเป็นงานใหม่อีกงาน · งาน "${esc(meta.name)}" ที่นับอยู่ยังอยู่ครบ สลับไปมาได้</div>`;
  h += `<div class="row"><button class="btn pri" data-a="doimport">${fresh ? 'นำเข้า + สร้างงานใหม่' : 'นำเข้า'} ${N(st.codes)} รายการ</button><button class="btn" data-a="cancelimport">ยกเลิก</button></div>`;
  return h;
}
