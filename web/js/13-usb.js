/* AssetSync · เมนู 6.1 เชื่อมต่อแบบออฟไลน์: ส่งงาน/รับผลนับผ่านไฟล์ในโฟลเดอร์ Download */
function usbCard() {
  const out = LS.get('usbOut-' + (meta?.id || ''), 0),
    n = mine.length - out;
  let h = `<div class="card" style="${usbMode ? 'border:2px solid var(--blue)' : ''}"><div class="row" style="justify-content:space-between;align-items:center"><b>เชื่อมต่อแบบไหน</b></div>
    <div class="seg" role="group" aria-label="โหมดเชื่อมต่อ" style="align-self:flex-start"><button data-a="usbmode" data-v="0" aria-pressed="${!usbMode}">ออนไลน์ (อินเทอร์เน็ต)</button><button data-a="usbmode" data-v="1" aria-pressed="${usbMode}">สาย USB (ไม่ใช้อินเทอร์เน็ต)</button></div>`;
  if (!usbMode)
    return (
      h +
      `<p class="sub">ใช้สาย USB เมื่อในพื้นที่ไม่มีอินเทอร์เน็ต · ผลนับจะส่งเป็นไฟล์ผ่านโฟลเดอร์ Download ของเครื่อง</p></div>`
    );
  h += `<p class="sub">1) คอมพิวเตอร์: หน้า "สาย USB" → ดาวน์โหลดแพ็กเกจ → ต่อสาย แล้ววางไฟล์ไว้ใน Download ของเครื่องสแกน</p>
    <button class="btn" data-a="pick" data-v="pkg">นำเข้าแพ็กเกจจากเครื่อง (.json)</button>
    ${meta ? `<p class="sub">ตอนนี้: <b>${esc(meta.name)}</b> · ${N(master.size)} รหัส</p>` : ''}
    <p class="sub">2) นับเสร็จ กดส่งออก ไฟล์จะไปอยู่ที่ Download → ต่อสาย แล้วคัดลอกไปคอมพิวเตอร์</p>
    <div class="cnt3"><div style="background:#f4f5fa"><b>${mine.length}</b><span style="font-size:11px">ผลนับในเครื่อง</span></div><div style="background:var(--ok-soft);color:var(--ok-ink)"><b>${out}</b><span style="font-size:11px">ส่งออกแล้ว</span></div><div style="background:var(--warn-soft);color:var(--warn-ink)"><b>${Math.max(0, n)}</b><span style="font-size:11px">ยังไม่ส่งออก</span></div></div>
    <button class="btn pri" data-a="usbreport" ${meta && mine.length ? '' : 'disabled'}>ส่งออกผลนับ (Report)</button>`;
  const last = LS.get('usbLast', null);
  if (last)
    h += `<div class="card" style="background:var(--ok-soft);padding:12px;gap:4px"><b>ไฟล์ล่าสุดอยู่ที่นี่</b><span class="mono" style="word-break:break-all">${esc(last.where)}/${esc(last.name)}</span><span class="sub">${fmtT(last.at)} · บนคอมพิวเตอร์: This PC → เครื่องสแกน → Internal shared storage → ${esc(last.where.replace(/\//g, ' → '))}</span></div>`;
  if (S.msg.usbApp) h += `<div class="msg ${S.msg.usbApp[1]}">${esc(S.msg.usbApp[0])}</div>`;
  return h + `</div>`;
}
function webUsb() {
  const info = LS.get('usbInfo-' + meta.id, {});
  let h = `<main class="wrap"><div><p class="sub">${esc(meta.name)} · ใช้เมื่อเครื่องสแกนไม่มีอินเทอร์เน็ต</p><h1>6.1 · เชื่อมต่อแบบออฟไลน์</h1></div><div class="row">
    <section class="card side"><span class="chip c-blue" style="align-self:flex-start">ขั้นที่ 1 · คอมพิวเตอร์ → เครื่องสแกน</span><h2>ส่งทะเบียนให้เครื่องสแกน</h2>
      <ol class="sub" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px"><li>กดดาวน์โหลดแพ็กเกจ (ไฟล์ .json)</li><li>ต่อสาย USB · บนเครื่องสแกนเลือก <b>ถ่ายโอนไฟล์ (File transfer)</b></li><li>คอมพิวเตอร์: This PC → ชื่อเครื่องสแกน → Internal storage → <b>Download</b> → วางไฟล์</li><li>เครื่องสแกน: แท็บ บัญชี → เลือก <b>สาย USB</b> → นำเข้าแพ็กเกจจากเครื่อง</li></ol>
      <p class="sub">แพ็กเกจมีทะเบียน ${N(master.size)} รหัส · พื้นที่ · ทีม · ผลนับล่าสุดของทุกเครื่อง (ไว้เช็กนับซ้ำ) · ส่งซ้ำได้เพื่ออัปเดตผลตัดสินของ Admin</p>
      <button class="btn pri" data-a="usbpkg" ${master.size ? '' : 'disabled'}>ดาวน์โหลดแพ็กเกจ</button>${S.msg.pkg ? `<div class="msg ${S.msg.pkg[1]}">${esc(S.msg.pkg[0])}</div>` : ''}</section>
    <section class="card grow"><span class="chip c-ok" style="align-self:flex-start">ขั้นที่ 2 · เครื่องสแกน → คอมพิวเตอร์</span><h2>รับผลนับจากเครื่องสแกน</h2>
      <ol class="sub" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px"><li>เครื่องสแกน: แท็บ บัญชี → <b>ส่งออกผลนับ (Report)</b></li><li>ต่อสาย USB · บนเครื่องสแกนเลือก <b>ถ่ายโอนไฟล์ (File transfer)</b></li><li>คอมพิวเตอร์: This PC → ชื่อเครื่องสแกน → Internal shared storage → <b>Download</b> → ไฟล์ <span class="mono">AssetSync-ผลนับ-….xlsx</span> (ถ้าไม่เห็น ให้ดูชื่อโฟลเดอร์ที่แอปบอกหลังกดส่งออก)</li><li>เลือกไฟล์ด้านล่าง (เลือกหลายไฟล์ / หลายเครื่องพร้อมกันได้ · นำเข้าไฟล์เดิมซ้ำไม่นับซ้ำ)</li></ol>
      <div class="drop" data-drop="usb"><b>ลากไฟล์ผลนับจากเครื่องสแกนมาวางตรงนี้</b><span class="sub">.xlsx ที่แอปส่งออก · เปิดดูใน Excel ได้ด้วย (ชีต ผลนับ)</span><button class="btn pri" data-a="pick" data-v="usb">เลือกไฟล์ (หลายไฟล์ได้)</button></div>
      ${S.msg.usb ? `<div class="msg ${S.msg.usb[1]}">${S.msg.usb[0].map(esc).join('<br>')}</div>` : ''}
      <div class="tbl-wrap"><table><thead><tr><th>ผู้ตรวจนับ</th><th>เครื่อง</th><th>รายการ</th><th>ไฟล์ล่าสุด</th><th>รับเมื่อ</th></tr></thead><tbody>${
        Object.entries(info)
          .map(
            ([d, x]) =>
              `<tr><td><b>${esc(x.by)}</b></td><td class="mono">${esc(d)}</td><td>${N(x.n)}</td><td>${esc(x.file)}</td><td>${fmtT(x.at)}</td></tr>`
          )
          .join('') || '<tr><td colspan="5" class="sub">ยังไม่ได้รับไฟล์</td></tr>'
      }</tbody></table></div></section></div></main>`;
  return h;
}
const rowsOfMaster = () =>
  [...master.values()].map(a => [a.code, a.name, a.ccName, a.cls, a.alt, a.raws, a.cc, a.wo, a.asset, a.sub]);
async function exportPackage() {
  const pkg = {
    kind: 'ams-package',
    v: 1,
    at: Date.now(),
    meta: { ...meta, status: meta.status === 'closed' ? 'closed' : 'counting' },
    rows: rowsOfMaster(),
    events: allEvents()
  };
  return save(`AssetSync-แพ็กเกจ-${meta.id}.json`, new TextEncoder().encode(JSON.stringify(pkg)), 'application/json');
}
async function importPackage(file) {
  let pkg;
  try {
    pkg = JSON.parse(await file.text());
  } catch {
    return ['ไฟล์นี้ไม่ใช่แพ็กเกจ AMS (.json)', 'bad'];
  }
  if (pkg?.kind !== 'ams-package' || !pkg.meta?.id || !Array.isArray(pkg.rows))
    return ['ไฟล์นี้ไม่ใช่แพ็กเกจ AMS', 'bad'];
  meta = pkg.meta;
  LS.set('meta', meta);
  jobId = meta.id;
  LS.set('jobId', meta.id);
  indexMaster(pkg.rows);
  LS.set('master', pkg.rows);
  LS.set('masterVer', meta.ver);
  loadMine();
  const others = {};
  let n = 0;
  for (const e of pkg.events || [])
    if (e && e.id && e.dev !== dev) {
      (others[e.dev] ||= []).push(e);
      n++;
    }
  usbEv = others;
  LS.set('usb-' + meta.id, usbEv);
  _cache = null;
  return [`นำเข้าแล้ว: ${meta.name} · ${N(master.size)} รหัส · ผลนับเครื่องอื่น ${N(n)} รายการ`, 'ok'];
}
async function exportReport() {
  const { cur } = compute(),
    wb = XLSX.utils.book_new();
  const view = [
    [
      'Asset',
      'ชื่อ',
      'แผนกในทะเบียน',
      'พื้นที่ที่พบ',
      'ห้อง',
      'ผลการนับ',
      'สภาพ',
      'ต้องพิมพ์สติกเกอร์ใหม่',
      'ชื่อบนสติกเกอร์ไม่ตรงระบบ',
      'สถานะโอนย้าย',
      'Remark',
      'ผู้นับ',
      'เวลานับ',
      'วิธีตรวจนับ'
    ]
  ];
  for (const s of [...cur.values()].filter(s => s.dev === dev).sort((a, b) => a.t - b.t)) {
    const a = master.get(s.code);
    view.push([
      s.code,
      a?.name || s.uname,
      a?.ccName || '',
      s.areaName,
      s.room,
      !a ? 'ไม่อยู่ในทะเบียน' : isOther(s) ? (s.dec === 'borrowed' ? 'พบ (ยืมมา)' : 'พบ (ของแผนกอื่น)') : 'พบ',
      s.cond,
      s.flags.reprint ? 'Y' : '',
      s.flags.namebad ? 'Y' : '',
      s.flags.pendingTransfer ? 'รอโอนย้าย' : '',
      s.remark,
      s.by,
      fmtT(s.t),
      SRC[s.src][0]
    ]);
  }
  const C = compute(),
    myLost = new Set(mine.filter(e => e.lost).map(e => e.code));
  for (const [code, L] of C.lost)
    if (myLost.has(code)) {
      const a = master.get(code);
      view.push([
        code,
        a?.name || '',
        a?.ccName || '',
        '',
        '',
        'สูญหาย',
        '',
        '',
        '',
        '',
        L.remark,
        L.by,
        fmtT(L.t),
        ''
      ]);
    }
  const myCC = new Set(mine.filter(e => String(e.code).startsWith('#CC:')).map(e => e.code.slice(4)));
  for (const [cc, d] of C.ccDone)
    if (myCC.has(cc))
      view.push([
        '',
        `ปิดงาน CC ${cc} ${ccNameOf(cc)}`,
        '',
        '',
        '',
        'นับครบแล้ว',
        '',
        '',
        '',
        '',
        d.left ? `ไม่พบ ${d.left} รายการ` : '',
        d.by,
        fmtT(d.t),
        ''
      ]);
  const raw = [['AMS Count USB', 1, meta.id, dev, S.user?.name || '', Date.now(), mine.length]];
  let buf = [],
    len = 0;
  for (const e of mine) {
    const j = JSON.stringify(e);
    if (len + j.length > 30000 && buf.length) {
      raw.push(['[' + buf.join(',') + ']']);
      buf = [];
      len = 0;
    }
    buf.push(j);
    len += j.length + 1;
  }
  if (buf.length) raw.push(['[' + buf.join(',') + ']']);
  const ws = XLSX.utils.aoa_to_sheet(view);
  ws['!cols'] = view[0].map((_, i) => ({ wch: i === 1 ? 36 : 14 }));
  XLSX.utils.book_append_sheet(wb, ws, 'ผลนับ');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raw), '_ams');
  wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  const d = new Date(),
    stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const r = await save(
    `AssetSync-ผลนับ-${S.user?.name || 'ไม่ระบุ'}-${dev}-${stamp}.xlsx`,
    new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  if (r[1] === 'ok') {
    LS.set('usbOut-' + meta.id, mine.length);
    LS.set('usbLast', {
      name: r[0].replace(/^บันทึกไฟล์แล้ว: /, '').split(' · ')[0],
      where: r[0].split(' · ')[1] || 'Download',
      at: Date.now()
    });
  }
  return r;
}
async function importReports(files) {
  const out = [],
    info = LS.get('usbInfo-' + meta.id, {});
  let bad = false;
  for (const f of files) {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }),
        ws = wb.Sheets['_ams'];
      if (!ws) {
        out.push(`${f.name}: ไม่ใช่ไฟล์ผลนับจากแอป`);
        bad = true;
        continue;
      }
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }),
        [tag, , round, d, by] = rows[0] || [];
      if (tag !== 'AMS Count USB' || !/^[\w-]{1,40}$/.test(String(d))) {
        out.push(`${f.name}: รูปแบบไฟล์ไม่ถูกต้อง`);
        bad = true;
        continue;
      }
      if (round !== meta.id) {
        out.push(`${f.name}: เป็นของรอบนับอื่น ไม่ได้นำเข้า`);
        bad = true;
        continue;
      }
      const items = [];
      for (const r of rows.slice(1))
        for (const e of JSON.parse(r[0] || '[]'))
          if (
            e &&
            typeof e.id === 'string' &&
            typeof e.code === 'string' &&
            ['scan', 'edit', 'del', 'rv'].includes(e.k)
          )
            items.push({ ...e, round: meta.id, dev: String(d) });
      const prev = usbEv[d] || [],
        ids = new Set(prev.map(e => e.id)),
        fresh = items.filter(e => !ids.has(e.id));
      usbEv[d] = [...prev, ...fresh].sort((a, b) => a.t - b.t);
      info[d] = { by: String(by || '?'), n: usbEv[d].length, at: Date.now(), file: f.name };
      if (db)
        for (let k = 0; k * CHUNK < usbEv[d].length; k++)
          await db.doc(`ev/${meta.id}-${d}-u${k}`).set({
            round: meta.id,
            dev: String(d),
            items: usbEv[d].slice(k * CHUNK, (k + 1) * CHUNK),
            at: Date.now(),
            via: 'usb'
          });
      out.push(`${f.name}: ${by} · ${N(items.length)} รายการ (ใหม่ ${N(fresh.length)})`);
    } catch (e) {
      out.push(`${f.name}: อ่านไม่ได้ (${e.message})`);
      bad = true;
    }
  }
  LS.set('usb-' + meta.id, usbEv);
  LS.set('usbInfo-' + meta.id, info);
  _cache = null;
  S.msg.usb = [out, bad ? 'warn' : 'ok'];
}
