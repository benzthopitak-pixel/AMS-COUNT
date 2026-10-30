/* AssetSync · เรื่องรอตรวจ (ย้ายแผนก / ไม่อยู่ในทะเบียน / ชำรุด) และเมนู 3 ปิดงาน */
const TABS = [
  ['move', 'ย้ายแผนก', 'c-oth'],
  ['unk', 'ไม่อยู่ในทะเบียน', 'c-bad'],
  ['dmg', 'ชำรุด / รอซ่อม', 'c-warn'],
  ['reprint', 'พิมพ์สติกเกอร์ใหม่', 'c-blue'],
  ['namebad', 'ชื่อบนป้ายไม่ตรง', 'c-blue'],
  ['transfer', 'รอโอนย้าย', 'c-oth'],
  ['cleared', 'ดำเนินการแล้ว', 'c-gray']
];
function webInbox(c) {
  const list = c[S.inboxTab] || [];
  if (S.inboxSel && !compute().cur.has(S.inboxSel)) S.inboxSel = null;
  const selCode = S.inboxSel || list[0]?.code || null;
  const open = c.move.length + c.unk.length + c.dmg.length;
  let h = `<main class="wrap"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><p class="sub">${esc(meta.name)} · เรื่องที่ Admin ต้องตัดสิน</p><h1>3 · กล่องตรวจ</h1><p class="sub">ค้างตัดสิน ${open} · ดำเนินการแล้ว ${c.cleared.length}</p></div>`;
  if (S.inboxTab === 'move')
    h += `<button class="btn dark" data-a="bulkapprove" ${S.inboxChecked.size ? '' : 'disabled'}>อนุมัติย้ายที่เลือก (${S.inboxChecked.size})</button>`;
  h += `</div><div class="pills">${TABS.map(([k, l, cl]) => `<button class="pill ${S.inboxTab === k ? 'on' : ''}" data-a="inboxtab" data-v="${k}">${l} [${c[k].length}]</button>`).join('')}</div><div class="row"><section class="side" style="display:flex;flex-direction:column;gap:8px">`;
  if (!list.length) h += `<div class="card"><p class="sub">ไม่มีเรื่องในแท็บนี้</p></div>`;
  for (const s of list.slice(0, 150)) {
    const a = master.get(s.code);
    h += `<div class="li" style="${s.code === selCode ? 'outline:2px solid var(--blue)' : ''}">${S.inboxTab === 'move' ? `<input type="checkbox" data-a="check" data-v="${esc(s.code)}" ${S.inboxChecked.has(s.code) ? 'checked' : ''} aria-label="เลือก ${esc(s.code)}" style="width:20px;height:20px;accent-color:var(--oth)">` : ''}
      <button data-a="inboxsel" data-v="${esc(s.code)}" style="all:unset;cursor:pointer;flex:1;min-width:0;display:flex;flex-direction:column" class="t"><b class="mono">${esc(s.code)}</b><span>${esc(a?.name || s.uname || '(ไม่มีชื่อ)')}</span><span>${a && isOther(s) ? `${esc(a.ccName)} → พบที่ ${esc(s.areaName)} · ${decLabel(s.dec)}` : `${esc(s.areaName)} · ${esc(s.by)}`}</span></button></div>`;
  }
  h += `</section><section class="card grow">${selCode ? inboxDetail(selCode) : '<p class="sub">เลือกเรื่องทางซ้าย</p>'}</section></div></main>`;
  return h;
}
const decLabel = d =>
  ({ moved: 'ผู้ตรวจนับ: ต้องการย้าย', borrowed: 'ผู้ตรวจนับ: ยืมมา', unsure: 'ผู้ตรวจนับ: รอตรวจสอบ' })[d] ||
  'ยังไม่ระบุ';
function inboxDetail(code) {
  const { cur, hist } = compute(),
    s = cur.get(code),
    a = master.get(code);
  if (!s) return '<p class="sub">ไม่มีผลนับ</p>';
  let h = `<div class="row" style="justify-content:space-between"><b class="mono" style="font-size:22px">${esc(code)}</b>${badge(s)}</div><div style="font-size:17px">${esc(a?.name || s.uname || '(ผู้ตรวจนับไม่ได้กรอกชื่อ)')}${a ? ` · Class ${esc(a.cls)}` : ''}</div>`;
  if (a)
    h += `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center;text-align:center"><div class="card" style="background:#f4f5fa;padding:12px"><span class="sub">ในทะเบียน</span><b>${esc(a.ccName)}</b>${a.ccName !== String(a.cc) ? `<span class="sub mono">${esc(a.cc)}</span>` : ''}</div><b style="color:var(--oth)">${isOther(s) ? '→' : '='}</b><div class="card" style="background:${isOther(s) ? 'var(--oth-soft)' : 'var(--ok-soft)'};padding:12px"><span class="sub">พบจริงที่</span><b>${esc(s.areaName)}</b><span class="sub">${esc(s.room || '')}</span></div></div>`;
  if (a && !isOther(s) && !s.shared && a.ccName !== s.areaName && a.ccName !== String(a.cc))
    h += `<div class="msg warn">⚠ CC ตรงกัน (${esc(a.cc)}) แต่ชื่อแผนกไม่ตรง: ทะเบียน "${esc(a.ccName)}" · พบที่ "${esc(s.areaName)}" · ไม่ต้องย้าย</div>`;
  h += `<p class="sub">${esc(s.by)} · ${fmtT(s.t)} · สภาพ <b>${esc(s.cond)}</b>${s.remark ? ' · ' + esc(s.remark) : ''}</p><div class="row" style="align-items:center">${srcChip(s)}${!a ? '' : s.src === 'qr' ? '<span class="chip c-ok">สแกนจาก QR · ไม่ต้องสร้างป้าย</span>' : s.hasQR ? `<span class="chip c-ok">ยืนยันแล้วว่ามี QR</span>${isLead() ? `<button class="btn sm" data-a="setqr" data-x="0" data-v="${esc(code)}">ยกเลิก (ยังไม่มี QR)</button>` : ''}` : s.printedAt ? `<span class="chip c-ok">ติด QR แล้ว ${fmtT(s.printedAt)}</span>` : `<span class="chip c-blue">ยังไม่มี QR · อยู่ในคิวพิมพ์</span>${isLead() ? `<button class="btn sm" data-a="setqr" data-x="1" data-v="${esc(code)}">✓ มีสติกเกอร์ QR แล้ว</button>` : ''}`}</div>`;
  const B = (act, label, cls) =>
    `<button class="btn ${cls || ''}" data-a="rv" data-act="${act}" data-v="${esc(code)}">${label}</button>`;
  const dl = dupOf(code);
  if (dl)
    h += `<div class="msg warn" style="display:flex;flex-direction:column;gap:6px"><b>สแกนซ้ำจาก ${dl.length + 1} เครื่อง (ตอนออฟไลน์)</b><span>ใช้ผลแรก: ${esc(s.by)} · ${fmtT(s.t)} · พบที่ ${esc(s.areaName)}</span>${dl.map(d => `<span>${esc(d.by)} · ${fmtT(d.t)} · พบที่ ${esc(d.areaName)}${String(d.area) !== String(s.area) ? ` <button class="btn sm" data-a="dupuse" data-v="${esc(code)}" data-cc="${esc(d.area)}" data-ccn="${esc(d.areaName)}">ใช้ที่พบนี้แทน</button>` : ' (ที่เดียวกัน)'} <button class="btn sm red" data-a="dupdrop" data-v="${esc(code)}" data-id="${esc(d.id)}">ลบรายการนี้</button></span>`).join('')}<button class="btn sm" data-a="rv" data-act="dup_ack" data-v="${esc(code)}" style="align-self:flex-start">รับทราบ</button></div>`;
  h += `<div class="row">`;
  if (isOther(s) && !s.rv.move)
    h +=
      B('approve_move', `อนุมัติย้ายไป ${esc(s.areaName)}`, 'oth') +
      B('keep', 'ไม่ย้าย (ยืมมา)') +
      B('recount', 'สั่งตรวจนับซ้ำ');
  if (!a && !s.rv.unk) h += B('unk_accept', 'รับเข้าทะเบียน', 'pri') + B('unk_reject', 'ไม่ใช่ทรัพย์สินของบริษัท');
  if ((s.cond === 'ชำรุด' || s.cond === 'รอซ่อม') && !s.rv.dmg) h += B('dmg_ack', 'รับทราบสภาพ', 'pri');
  if (!isOther(s) || s.rv.move) h += B('recount', 'สั่งตรวจนับซ้ำ');
  h += `</div><div><span class="sub">ป้าย + การโอนย้าย (แตะเพื่อเปิด/ปิด)</span><div class="chips" style="margin-top:6px">${flagChips(s, 'leadflag')}</div></div>`;
  h += `<div class="card" style="background:#f8f9fc;padding:12px"><b>ประวัติ</b>${(hist.get(code) || []).map(x => `<span class="sub">${fmtT(x.t)} · ${esc(x.by)} · ${esc(x.txt)}</span>`).join('')}</div>`;
  return h;
}
function flagChips(s, act) {
  return [
    ['reprint', 'ต้องพิมพ์สติกเกอร์ใหม่'],
    ['namebad', 'ชื่อบนสติกเกอร์ไม่ตรงระบบ'],
    ['pendingTransfer', 'รอโอนย้าย']
  ]
    .map(
      ([k, l]) =>
        `<button class="tog" aria-pressed="${!!s.flags[k]}" data-a="${act}" data-f="${k}" data-v="${esc(s.code)}">${s.flags[k] ? '✓ ' : ''}${l}</button>`
    )
    .join('');
}

/* ---------- ④⑤ close + export ---------- */
function webExport(c, inner) {
  const T = totals(),
    closed = meta.status === 'closed';
  const card = (tag, color, title, sub, btns) =>
    `<div class="card"><span style="font-size:12px;font-weight:600;color:${color}">${tag}</span><b style="font-size:17px">${title}</b><span class="sub">${sub}</span><div class="row" style="gap:6px">${btns}</div></div>`;
  const rep = (k, title, sub) =>
    card(
      'PDF · Excel',
      'var(--blue-ink)',
      title,
      sub,
      `<button class="btn sm pri" data-a="exprep" data-k="${k}" data-v="pdf">⬇ PDF</button><button class="btn sm" data-a="exprep" data-k="${k}" data-v="xlsx">⬇ Excel</button>`
    );
  let h = `${inner ? '' : `<main class="wrap"><div><p class="sub">${esc(meta.name)}</p><h1>ส่งรายงาน</h1></div>`}<p class="sub">${closed ? 'ปิดรอบแล้ว' : 'ก่อนปิดรอบ ไฟล์จะระบุว่า "ฉบับร่าง"'}</p>
    <h2>ไฟล์สำหรับ SAP</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    <div class="card" style="background:var(--blue);color:#fff"><span style="font-size:12px;font-weight:600;color:#d6ddff">XLSX · ไฟล์หลัก</span><b style="font-size:17px">ผลตรวจนับตามแม่แบบไฟล์ที่นำเข้า</b><span style="font-size:13px;color:#e3e8ff">ASSET · สรุป · Transfer · write-off · สรุป write-off · คิวพิมพ์สติกเกอร์ · ไม่อยู่ในทะเบียน</span><button class="btn lime" data-a="export" data-v="main" style="align-self:flex-start">⬇ ดาวน์โหลด</button></div>
    ${card('XLSX · Transfer (AS02)', 'var(--oth-ink)', 'รายการรอโอนย้าย', `${N(totals().other)} รายการต้องย้าย CC`, '<button class="btn sm" data-a="export" data-v="transfer">⬇ ดาวน์โหลด</button>')}
    ${card('XLSX · Write-Off (ABAVN)', 'var(--bad-ink)', 'รายการที่ไม่พบ', `${N(T.left)} รายการที่ยังไม่พบ`, '<button class="btn sm" data-a="export" data-v="writeoff">⬇ ดาวน์โหลด</button>')}</div>
    <h2>รายงานสรุป</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    ${rep('sum', 'สรุปผลตรวจนับ', 'ทีละ CC พร้อมแถวรวม')}${rep('nf', 'รายการที่ตรวจไม่พบ', 'ไม่พบ / สูญหาย')}${rep('qr', 'ต้องพิมพ์ QR ใหม่', 'พร้อมเหตุผล')}${rep('mv', 'รายการย้ายแผนก', 'รออนุมัติ / รอโอนย้าย')}${rep('bw', 'รายการยืมมา', 'ไม่ย้าย CC')}${rep('cr', 'สรุปตามที่เลือก', 'ตามที่ตั้งไว้ในแท็บ สรุปตามที่เลือก')}${card('Pivot', 'var(--blue-ink)', 'ตาราง Pivot ที่สร้างเอง', 'สร้างและดาวน์โหลดที่เมนู 4.1 Pivot Report', '<button class="btn sm" data-a="gopivot">ไปหน้า Pivot →</button>')}</div>
    <h2>สติกเกอร์</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    ${card('PDF · Excel แม่แบบ OGA', 'var(--blue-ink)', 'คิวพิมพ์สติกเกอร์', `${c.reprint.length + c.namebad.length} ดวงในคิว · เลือกรายการที่เมนู 5`, '<button class="btn sm" data-a="web" data-v="stickers">ไปหน้าพิมพ์สติกเกอร์ →</button>')}</div>
    ${S.msg.exp ? `<div class="msg ${S.msg.exp[1]}">${esc(S.msg.exp[0])}</div>` : ''}${inner ? '' : '</main>'}`;
  return h;
}
function webClose(c) {
  const T = totals(),
    areas = meta.areas || [],
    unassigned = areas.filter(a => !a.shared && !a.assignee).length,
    open = c.move.length + c.unk.length + c.dmg.length,
    closed = meta.status === 'closed';
  const ck = (ok, title, sub) =>
    `<div class="row" style="align-items:flex-start"><span class="dot" style="width:28px;height:28px;background:${ok ? 'var(--ok)' : 'var(--warn)'}">${ok ? '✓' : '!'}</span><span style="flex:1"><b>${title}</b><br><span class="sub">${sub}</span></span></div>`;
  let h = `<main class="wrap"><div class="row"><section class="card side"><h1>3 · ปิดงาน</h1>`;
  if (closed)
    h += `<div class="msg ok">ปิดรอบแล้ว ${fmtT(meta.closedAt)} · ที่ยังไม่พบ: ${meta.leftChoice === 'writeoff' ? 'ลง Write-Off' : 'เปิดนับซ้ำ'} · แอปหยุดนับรอบนี้</div><button class="btn" data-a="reopen">เปิดรอบอีกครั้ง</button>`;
  else {
    h += ck(
      pendingCount() === 0,
      'เครื่องนี้ส่งข้อมูลครบ',
      pendingCount() ? `รอส่ง ${pendingCount()}` : 'ครบ · เครื่องอื่นดูที่เมนู 2 รายการตรวจนับ'
    );
    {
      const real = (meta.areas || []).filter(a => !a.shared),
        shut = real.filter(a => ccClosed(a.code)).length;
      h += ck(
        shut === real.length,
        'ผู้ตรวจนับปิดงานครบทุก CC',
        `ปิดแล้ว ${shut} / ${real.length} CC${shut < real.length ? ' · ที่ยังไม่ปิดดูได้ที่เมนู 2 รายการตรวจนับ' : ''}`
      );
    }
    h += ck(
      open === 0,
      'เรื่องที่ต้องตัดสินเคลียร์หมด',
      open ? `ค้าง ${open} เรื่อง · ดูที่เมนู 2 รายการตรวจนับ` : 'ครบ'
    );
    h += `<b>ที่ยังไม่พบ ${N(T.left)} รหัส</b><label class="li" style="background:#f4f5fa"><input type="radio" name="left" data-a="leftchoice" value="writeoff" ${S.closeChoice === 'writeoff' ? 'checked' : ''}> ลง Write-Off ทั้งหมด</label><label class="li" style="background:#f4f5fa"><input type="radio" name="left" data-a="leftchoice" value="recount" ${S.closeChoice === 'recount' ? 'checked' : ''}> เปิดนับซ้ำก่อน (ไม่ลง Write-Off)</label>`;
    h += `<button class="btn dark" data-a="closeround">${open ? `ปิดรอบ (ยังค้าง ${open} เรื่อง)` : 'ปิดรอบ'}</button>${open ? '<p class="sub">ปิดได้ แต่เรื่องที่ค้างจะติดไปในไฟล์ส่งออกตามสถานะล่าสุด</p>' : ''}`;
  }
  h += `<p class="sub">ไฟล์ส่งออกทั้งหมดอยู่ที่เมนู <b>4.2 รายงานสรุปผล</b> → แท็บ ไฟล์ส่งออก</p><button class="btn" data-a="web" data-v="export" style="align-self:flex-start">ไปหน้าไฟล์ส่งออก →</button></section></div></main>`;
  return h;
}
