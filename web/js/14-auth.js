/* AssetSync · เข้าสู่ระบบ, ตั้งค่าครั้งแรก, เมนู 6.2 User และหน้าค้นหารายการบนเครื่องยิง */
function gateView() {
  const cfg = Store.auth.config(),
    msg = S.gateMsg ? `<div class="msg bad">${esc(S.gateMsg)}</div>` : '';
  const wrap =
    inner => `<div class="phone" style="min-height:100vh;justify-content:center"><div class="pbody" style="padding-bottom:40px">
    <div class="brand"><img src="logo.svg" alt="Innovative Passionately"><b>AssetSync</b><span>ระบบตรวจนับทรัพย์สิน · ${esc(VER())}</span></div>${inner}</div></div>${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}`;
  if (S.gate === 'boot') return wrap(`<div class="card"><p class="sub">กำลังเชื่อมต่อ…</p></div>`);
  if (S.gate === 'setup')
    return wrap(`<div class="card"><h2>ตั้งค่าการเชื่อมต่อ</h2><p class="sub">ใส่ค่าจาก Supabase → Project Settings → API (ทำครั้งเดียวต่อเครื่อง)</p>
    <label class="f">Project URL<input class="in mono" id="cfgUrl" value="${esc(cfg.url)}" placeholder="https://xxxx.supabase.co" autocomplete="off"></label>
    <label class="f">anon public key<textarea class="in mono" id="cfgKey" rows="3" placeholder="eyJhbGciOi…">${esc(cfg.key)}</textarea></label>${msg}
    <button class="btn pri" data-a="savecfg">บันทึกและเชื่อมต่อ</button>${Store.auth.configured() ? '<button class="btn" data-a="cancelcfg">ยกเลิก</button>' : ''}<p class="sub">ห้ามใส่ service_role key</p></div>
    <div class="card"><b>ไม่มีอินเทอร์เน็ตที่นี่?</b><p class="sub">ใช้โหมดสาย USB ส่งข้อมูลผ่านไฟล์แทน</p><button class="btn" data-a="usbmode" data-v="1">ใช้โหมดสาย USB</button></div>`);
  if (S.gate === 'inactive')
    return wrap(
      `<div class="card"><h2>รอ Admin เปิดใช้บัญชี</h2><p class="sub">บัญชี ${esc(S.user?.name || '')} (${esc(S.user?.code || '')}) ยังไม่ได้เปิดใช้ · ให้ Admin เปิดที่เมนู 6.2 User บนคอมพิวเตอร์</p><button class="btn" data-a="logout">ออกจากระบบ</button></div>`
    );
  if (S.firstRun)
    return wrap(`<div class="card"><h2>เริ่มใช้ครั้งแรก · สร้างบัญชี Admin</h2><p class="sub">ระบบยังไม่มีผู้ใช้ บัญชีแรกจะเป็น Admin (นำเข้าทะเบียน มอบงาน ตรวจ ปิดรอบ)</p>
    <label class="f">ชื่อ<input class="in" id="flName" autocomplete="name"></label>
    <label class="f">รหัสพนักงาน<input class="in mono" id="flCode" autocomplete="username"></label>
    <label class="f">PIN (ตัวเลข 4–8 หลัก)<input class="in mono" id="flPin" type="password" inputmode="numeric" autocomplete="new-password"></label>${msg}
    <button class="btn pri" data-a="firstlead" ${S.busy ? 'disabled' : ''}>สร้างบัญชี Admin</button>
    <button class="btn sm" data-a="editcfg" style="align-self:flex-start">ตั้งค่าการเชื่อมต่อ</button></div>`);
  return wrap(`<form class="card" id="loginForm"><h2>เข้าสู่ระบบ</h2>
    <label class="f">รหัสพนักงาน<input class="in mono" id="lgCode" autocomplete="username" value="${esc(S.lgCode ?? LS.get('lastCode', ''))}"></label>
    <label class="f">PIN<input class="in mono" id="lgPin" type="password" inputmode="numeric" autocomplete="current-password"></label>${msg}
    <button class="btn pri" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button></form>
    <div class="row"><button class="btn sm" data-a="editcfg">ตั้งค่าการเชื่อมต่อ (Admin)</button><button class="btn sm" data-a="usbmode" data-v="1">โหมดสาย USB</button></div>
    <p class="sub">ลืม PIN? ให้ Admin ตั้งใหม่ที่เมนู 6.2 User · เครื่องนี้: ${esc(dev)}</p>`);
}
async function doLogin() {
  const code = $('#lgCode')?.value.trim(),
    pin = $('#lgPin')?.value.trim();
  if (!code || !pin) {
    S.gateMsg = 'ใส่รหัสพนักงานและ PIN';
    render();
    return;
  }
  S.lgCode = code;
  S.busy = true;
  S.gateMsg = null;
  render();
  try {
    await Store.auth.login(code, pin);
    LS.set('lastCode', code);
    S.busy = false;
    S.gate = 'boot';
    render();
    await connect();
  } catch (e) {
    S.busy = false;
    S.gateMsg = /invalid/i.test(e.message)
      ? 'รหัสพนักงานหรือ PIN ไม่ถูกต้อง'
      : /fetch|network/i.test(e.message)
        ? 'เชื่อมต่อไม่ได้ · กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง'
        : e.message;
    render();
  }
}
async function doFirstLead() {
  const name = $('#flName').value.trim(),
    code = $('#flCode').value.trim(),
    pin = $('#flPin').value.trim();
  if (!name || !code) {
    S.gateMsg = 'ใส่ชื่อและรหัสพนักงาน';
    render();
    return;
  }
  if (!/^\d{4,8}$/.test(pin)) {
    S.gateMsg = 'PIN ต้องเป็นตัวเลข 4–8 หลัก';
    render();
    return;
  }
  S.busy = true;
  S.gateMsg = null;
  render();
  try {
    await Store.auth.firstLead(name, code, pin);
    LS.set('lastCode', code);
    S.busy = false;
    S.firstRun = false;
    S.gate = 'boot';
    render();
    await connect();
  } catch (e) {
    S.busy = false;
    S.gateMsg = e.message;
    render();
  }
}
async function teamOp(fn, ok) {
  try {
    await fn();
    await loadTeam();
    if (meta && isLead()) await saveMeta({ ...meta });
    flash(ok);
    S.msg.team = null;
  } catch (e) {
    flash('ไม่สำเร็จ');
    S.msg.team = ['ไม่สำเร็จ: ' + e.message, 'bad'];
  }
  render();
}
async function addMember() {
  const name = $('#nmName').value.trim(),
    code = $('#nmCode').value.trim(),
    pin = $('#nmPin').value.trim(),
    role = $('#nmRole').value;
  if (!name || !code) {
    S.msg.team = ['ใส่ชื่อและรหัสพนักงาน', 'bad'];
    render();
    return;
  }
  if (!/^[A-Za-z0-9._-]{2,30}$/.test(code)) {
    S.msg.team = ['รหัสพนักงานใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข . _ -', 'bad'];
    render();
    return;
  }
  if (!/^\d{4,8}$/.test(pin)) {
    S.msg.team = ['PIN ต้องเป็นตัวเลข 4–8 หลัก', 'bad'];
    render();
    return;
  }
  if (S.team.some(u => u.code.toLowerCase() === code.toLowerCase())) {
    S.msg.team = ['รหัสพนักงานนี้มีอยู่แล้ว', 'bad'];
    render();
    return;
  }
  S.busy = true;
  render();
  try {
    await Store.auth.addMember(name, code, pin, role);
    await loadTeam();
    if (meta) await saveMeta({ ...meta });
    S.msg.team = [`เพิ่ม ${name} แล้ว · เข้าสู่ระบบด้วยรหัส ${code} + PIN ที่ตั้งไว้`, 'ok'];
  } catch (e) {
    S.msg.team = [
      /registered|exists/i.test(e.message) ? 'รหัสพนักงานนี้เคยสมัครไว้แล้ว' : 'เพิ่มไม่สำเร็จ: ' + e.message,
      'bad'
    ];
  }
  S.busy = false;
  render();
}
function webTeam() {
  const cfg = Store.auth.config(),
    lead = S.user?.role === 'lead';
  let h = `<main class="wrap"><div><p class="sub">บัญชีผู้ใช้และการเชื่อมต่อ</p><h1>6.2 · User</h1></div><div class="row"><section class="card grow"><h2>ทีม (${S.team.filter(u => u.active).length} คนที่ใช้งานได้)</h2>
    <div class="tbl-wrap"><table><thead><tr><th>ชื่อ</th><th>รหัสพนักงาน</th><th>บทบาท</th><th>สถานะ</th>${lead ? '<th>ตั้ง PIN ใหม่</th><th></th>' : ''}</tr></thead><tbody>`;
  for (const u of S.team)
    h += `<tr><td>${lead && S.editName === u.id ? `<div class="row" style="flex-wrap:nowrap"><input class="in" id="nm-${u.id}" value="${esc(u.name)}" style="width:150px"><button class="btn sm pri" data-a="memname" data-v="${u.id}">บันทึก</button><button class="btn sm" data-a="noname">ยกเลิก</button></div>` : `<b>${esc(u.name)}</b>${u.id === S.user?.id ? ' <span class="chip c-blue">คุณ</span>' : ''}${lead ? ` <button class="btn sm" data-a="editname" data-v="${u.id}" aria-label="แก้ชื่อ ${esc(u.name)}" style="min-height:28px;padding:2px 8px">แก้ชื่อ</button>` : ''}`}</td><td class="mono">${esc(u.code)}</td>
    <td>${lead && u.id !== S.user?.id ? `<button class="btn sm" data-a="memrole" data-v="${u.id}">${u.role === 'lead' ? 'Admin' : 'ผู้ตรวจนับ'} ⇄</button>` : u.role === 'lead' ? 'Admin' : 'ผู้ตรวจนับ'}</td>
    <td>${lead && u.id !== S.user?.id ? `<button class="btn sm ${u.active ? '' : 'red'}" data-a="memactive" data-v="${u.id}">${u.active ? 'ใช้งานได้' : 'ปิดใช้อยู่'}</button>` : `<span class="chip ${u.active ? 'c-ok' : 'c-gray'}">${u.active ? 'ใช้งานได้' : 'ปิดใช้'}</span>`}</td>
    ${lead ? `<td><div class="row" style="flex-wrap:nowrap"><input class="in mono" id="pin-${u.id}" type="password" inputmode="numeric" placeholder="PIN ใหม่" style="width:110px"><button class="btn sm" data-a="mempin" data-v="${u.id}">ตั้ง</button></div></td><td>${u.id === S.user?.id ? '' : S.confirmMem === u.id ? `<div class="row" style="flex-wrap:nowrap"><button class="btn sm red" data-a="memdel" data-v="${u.id}">ยืนยันลบ</button><button class="btn sm" data-a="nomemdel">ไม่</button></div>` : `<button class="btn sm red" data-a="askmemdel" data-v="${u.id}">ลบ</button>`}</td>` : ''}</tr>`;
  h += `</tbody></table></div>`;
  if (lead)
    h += `<b>เพิ่มคนในทีม</b><div class="grid"><label class="f">ชื่อ<input class="in" id="nmName"></label><label class="f">รหัสพนักงาน<input class="in mono" id="nmCode"></label><label class="f">PIN เริ่มต้น<input class="in mono" id="nmPin" inputmode="numeric" placeholder="4–8 หลัก"></label><label class="f">บทบาท<select class="in" id="nmRole"><option value="counter">ผู้ตรวจนับ</option><option value="lead">Admin</option></select></label></div>
    <button class="btn pri" data-a="addmember" style="align-self:flex-start" ${S.busy ? 'disabled' : ''}>เพิ่มเข้าทีม</button>${S.msg.team ? `<div class="msg ${S.msg.team[1]}">${esc(S.msg.team[0])}</div>` : ''}`;
  h += `</section><aside class="side" style="display:flex;flex-direction:column;gap:12px"><section class="card"><h2>การเชื่อมต่อ</h2><p class="sub">Supabase: <span class="mono">${esc(cfg.url.replace(/^https:\/\//, ''))}</span></p><p class="sub">คุณ: ${esc(S.user?.name || '')} · ${esc(S.user?.code || '')} · เครื่อง ${esc(dev)}</p>
    <div class="row"><button class="btn sm" data-a="editcfg">เปลี่ยนการเชื่อมต่อ</button><button class="btn sm red" data-a="logout">ออกจากระบบ</button></div></section>
    <section class="card"><h2>ติดตั้งแอปบนเครื่องสแกน</h2><p class="sub">เปิดหน้าติดตั้งบนเครื่องสแกน หรือสแกน QR นี้</p><div class="sticker" style="transform:none;width:180px"><canvas id="installQr" width="360" height="360" aria-label="QR หน้าติดตั้งแอป"></canvas></div><a class="btn" href="install.html" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">เปิดหน้าติดตั้งแอป</a></section></aside></div></main>`;
  return h;
}

/* ---------- search (item without a sticker) ---------- */
function searchHits() {
  const q = norm(S.search.q),
    { cur } = compute(),
    here = String(S.area?.code || '');
  let list = [...master.values()].filter(a => counted(a));
  if (!S.search.all) list = list.filter(a => !cur.has(a.code));
  if (q)
    list = list.filter(
      a => a.code.includes(q) || norm(a.name).includes(q) || (a.alt && a.alt.includes(q)) || norm(a.ccName).includes(q)
    );
  else list = list.filter(a => String(a.cc) === here);
  list.sort((a, b) => (String(b.cc) === here) - (String(a.cc) === here) || a.code.localeCompare(b.code));
  return { total: list.length, list: list.slice(0, 60) };
}
function searchSheet() {
  const { cur } = compute(),
    r = searchHits(),
    q = S.search.q.trim();
  let h = `<div class="sheetbg" data-a="closesearch"><div class="sheet" data-stop="1"><div class="row" style="justify-content:space-between;align-items:center"><h2>ค้นหารายการ</h2><button class="btn sm" data-a="closesearch">ปิด</button></div>
    <input class="in" id="srchIn" value="${esc(S.search.q)}" placeholder="เลข Asset หรือชื่อ เช่น โต๊ะ, 51000" autocomplete="off" inputmode="text" aria-label="ค้นหาเลข Asset หรือชื่อ">
    <div class="tabs3"><button class="${S.search.all ? '' : 'on'}" data-a="srchall" data-v="0">ยังไม่ได้นับ</button><button class="${S.search.all ? 'on' : ''}" data-a="srchall" data-v="1">ทั้งหมด</button></div>
    <span class="sub">${q ? `พบ ${N(r.total)} รายการ` : `${S.area ? 'แผนก ' + esc(S.area.name) + ' · ' : ''}${N(r.total)} รายการ · พิมพ์เพื่อค้นหาทุกแผนก`}${r.total > r.list.length ? ` · แสดง ${r.list.length} รายการแรก` : ''}</span>`;
  for (const a of r.list) {
    const s = cur.get(a.code);
    h += `<button class="li" data-a="openitem" data-v="${esc(a.code)}"><span class="t"><b class="mono">${esc(a.code)}</b><span>${esc(a.name)}</span><span>${esc(a.ccName)}${a.raws.length > 1 ? ` · ${a.raws.length} แถว` : ''}</span></span>${s ? '<span class="chip c-ok">นับแล้ว</span>' : '<span class="chip c-warn">ยังไม่นับ</span>'}</button>`;
  }
  if (!r.list.length) h += `<p class="sub" style="text-align:center">ไม่พบรายการ</p>`;
  if (q && !master.has(resolve(q)) && (!r.total || q.length >= 7))
    h += `<button class="btn" data-a="srchsave" style="border-style:dashed">ไม่มีในทะเบียน · บันทึกรหัส "${esc(q.toUpperCase())}" ว่าพบที่นี่</button>`;
  return h + `</div></div>`;
}
