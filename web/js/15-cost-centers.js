/* AssetSync · เมนู 6.3 รายชื่อ Cost Center: รหัส → ชื่อแผนก ใช้ตั้งชื่อพื้นที่ให้ไฟล์ทะเบียนที่ไม่มีคอลัมน์ชื่อแผนก
 * เก็บใน kv "ccnames" = { map: { '1010110': 'HO:Acct. - Center', ... }, file, col, at } · ทุกเครื่องใช้ชุดเดียวกัน */
let ccList = LS.get('ccList', { map: {}, file: '', col: '', at: 0 });
const ccListName = code => ccList.map[ccKey(code)] || '';

async function ccLoad() {
  if (!db) return;
  try {
    const d = await db.doc('ccnames').get();
    if (d.exists && d.data()?.map) {
      ccList = d.data();
      LS.set('ccList', ccList);
      render();
    }
  } catch {}
}
async function ccSave(next) {
  ccList = { ...next, at: Date.now() };
  LS.set('ccList', ccList);
  if (db) await db.doc('ccnames').set(ccList);
}

// read the company's Cost Center file: header row with "Cost Center" + "Name" (SAP short name) and/or "DESCRIPTION"
async function ccReadFile(f) {
  const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', codepage: 874 }),
    hidden = new Set((wb.Workbook?.Sheets || []).filter(x => x.Hidden).map(x => x.name));
  const n = h => norm(h).replace(/\s+/g, ' ');
  for (const name of wb.SheetNames.filter(s => !hidden.has(s))) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const h = rows[i].map(n),
        code = h.findIndex(x => x === 'COST CENTER' || x === 'COST CTR' || x === 'CC'),
        cols = [
          ['name', h.findIndex(x => x === 'NAME' || x === 'COST CENTER NAME' || x === 'CC NAME' || x === 'SHORT TEXT')],
          ['desc', h.findIndex(x => x === 'DESCRIPTION' || x === 'LONG TEXT' || x === 'แผนก')]
        ].filter(([, ix]) => ix >= 0);
      if (code < 0 || !cols.length) continue;
      const out = {};
      for (const [k, ix] of cols) {
        const map = {};
        for (const r of rows.slice(i + 1)) {
          const c = ccKey(r[code]),
            v = String(r[ix] ?? '')
              .replace(/\s+/g, ' ')
              .trim();
          if (/^\d{3,}$/.test(c) && v) map[c] = v;
        }
        out[k] = map;
      }
      if (Object.values(out).some(m => Object.keys(m).length)) return { file: f.name, sheet: name, ...out };
    }
  }
  return null;
}

// put the names on the open job: areas (CC list on the scanner) + register rows whose department name is only the code
async function ccApplyToJob() {
  if (!meta || !master.size) return 0;
  let n = 0;
  const areas = (meta.areas || []).map(a => {
    const nm = !a.shared && (a.name === a.code || !a.name) && ccListName(a.code);
    if (nm) n++;
    return nm ? { ...a, name: nm } : a;
  });
  if (!n) return 0;
  const rows = rowsOfMaster().map(r =>
    (r[2] === r[6] || !r[2]) && ccListName(r[6]) ? [r[0], r[1], ccListName(r[6]), ...r.slice(3)] : r
  );
  await saveMaster(rows, { ...meta, areas });
  return n;
}

function webCostCenters() {
  if (!S.ccLoaded) {
    S.ccLoaded = true;
    ccLoad();
  }
  const P = S.ccPend,
    cur = Object.entries(ccList.map),
    q = norm(S.ccnQ || ''),
    list = (P ? Object.entries(P[P.col]) : cur)
      .filter(([c, v]) => !q || c.includes(q) || norm(v).includes(q))
      .sort((a, b) => a[0].localeCompare(b[0]));
  const used = meta ? (meta.areas || []).filter(a => !a.shared) : [],
    noName = used.filter(a => a.name === a.code || !a.name),
    canFill = noName.filter(a => ccListName(a.code)).length;
  let h = `<main class="wrap"><div><p class="sub">ใช้ตั้งชื่อแผนกให้ไฟล์ทะเบียนที่มีแค่รหัส Cost Center</p><h1>6.3 · รายชื่อ Cost Center</h1></div><div class="row">
    <section class="card grow"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${P ? `ตรวจสอบก่อนบันทึก · ${N(Object.keys(P[P.col]).length)} รหัส` : `รายชื่อในระบบ · ${N(cur.length)} รหัส`}</h2>
      <input class="in" id="ccnQ" placeholder="ค้นหารหัส หรือชื่อ" value="${esc(S.ccnQ || '')}" style="max-width:260px"></div>
      <div class="tbl-wrap" style="max-height:62vh;overflow-y:auto"><table><thead><tr><th style="width:140px">Cost Center</th><th>ชื่อแผนก</th>${meta ? '<th style="width:150px">ในงานที่เปิดอยู่</th>' : ''}</tr></thead><tbody>
      ${list.map(([c, v]) => `<tr><td class="mono">${esc(c)}</td><td>${esc(v)}</td>${meta ? `<td>${used.some(a => String(a.code) === c) ? '<span class="chip c-blue">ใช้อยู่</span>' : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="3" class="sub">${cur.length || P ? 'ไม่พบ' : 'ยังไม่มีรายชื่อ · เลือกไฟล์ Cost Center ทางขวา'}</td></tr>`}
      </tbody></table></div></section>
    <section class="card side"><h2 style="margin:0">อัปเดตรายชื่อ</h2>
      <p class="sub">เลือกไฟล์ Excel รายชื่อ Cost Center ของบริษัท (เช่น Cost Center - SAP S4 Hana) · ต้องมีคอลัมน์ <b>Cost Center</b> และ <b>Name</b> หรือ <b>DESCRIPTION</b></p>
      <button class="btn" data-a="pick" data-v="cc">📄 เลือกไฟล์ Cost Center</button>`;
  if (P)
    h += `<div class="msg ok">${esc(P.file)} · ชีต ${esc(P.sheet)}</div>
      ${P.name && P.desc ? `<label class="f">ใช้ชื่อจากคอลัมน์<select class="in" id="ccCol"><option value="name" ${P.col === 'name' ? 'selected' : ''}>Name (สั้น เช่น ${esc(Object.values(P.name)[0] || '')})</option><option value="desc" ${P.col === 'desc' ? 'selected' : ''}>DESCRIPTION (ยาว เช่น ${esc(Object.values(P.desc)[0] || '')})</option></select></label>` : ''}
      <div class="row"><button class="btn pri" data-a="ccsave">บันทึก ${N(Object.keys(P[P.col]).length)} รหัส</button><button class="btn" data-a="cccancel">ยกเลิก</button></div>
      <span class="sub">บันทึกแล้วแทนรายชื่อเดิมทั้งหมด · ทุกเครื่องใช้รายชื่อเดียวกัน</span>`;
  else if (ccList.file)
    h += `<span class="sub">ล่าสุด: ${esc(ccList.file)}${ccList.at ? ' · ' + fmtT(ccList.at) : ''}</span>`;
  if (meta && !P)
    h += `<div class="card" style="gap:8px"><b>งานที่เปิดอยู่: ${esc(meta.name)}</b><span class="sub">${noName.length ? `${noName.length} แผนกยังแสดงเป็นรหัส · หาชื่อได้ ${canFill} แผนก` : 'ทุกแผนกมีชื่อแล้ว'}</span>
      ${canFill ? `<button class="btn pri" data-a="ccapply">ใส่ชื่อแผนกให้งานนี้ (${canFill})</button>` : ''}<span class="sub">งานใหม่ที่นำเข้าหลังจากนี้ใส่ชื่อให้เองอัตโนมัติ</span></div>`;
  if (S.msg.cc) h += `<div class="msg ${S.msg.cc[1]}">${esc(S.msg.cc[0])}</div>`;
  return h + `</section></div></main>`;
}
