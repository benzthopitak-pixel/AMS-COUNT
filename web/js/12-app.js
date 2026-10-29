/* AssetSync · หน้าจอแอปเครื่องยิง: งาน, เลือกพื้นที่, สแกน, ผลนับ, บัญชี และหน้าต่างแจ้งเตือน (ซ้ำ / เลือก Sub) */
function appView(c) {
  let h = `<div class="phone">`;
  if (!S.user) h += appLogin();
  else if (!meta || !master.size)
    h += `<div class="pbody"><div class="card"><h2>ยังไม่มีงาน</h2><p class="sub">${!meta ? 'Admin ยังไม่สร้างรอบนับ' : 'Admin กำลังเตรียมรอบ ยังไม่ปล่อยภารกิจ'} · หน้านี้อัปเดตเองเมื่อพร้อม</p></div>${appMeBlock()}</div>`;
  else if (S.app === 'home') h += appHome(c);
  else if (S.app === 'area') h += appArea();
  else if (S.app === 'scan') h += appScan();
  else if (S.app === 'feed') h += appFeed();
  else if (S.app === 'me') h += `<div class="pbody">${appMeBlock()}</div>`;
  h += `</div>`;
  if (S.user && meta && master.size) {
    const B = (v, l) => `<button class="${S.app === v ? 'on' : ''}" data-a="app" data-v="${v}">${l}</button>`;
    h += `<nav class="bnav" aria-label="เมนูแอป"><div class="bnav-in">${B('home', 'งาน')}${B('area', 'พื้นที่')}<button class="fab" data-a="app" data-v="scan" aria-label="สแกน">สแกน</button>${B('feed', 'ผลนับ')}${B('me', 'บัญชี')}</div></nav>`;
  }
  if (S.updReady && S.mode === 'app')
    h += `<div style="position:fixed;left:12px;right:12px;top:calc(8px + env(safe-area-inset-top, 0px));z-index:35;max-width:440px;margin:0 auto"><div class="card dark" style="flex-direction:row;align-items:center;gap:10px;padding:10px 12px;background:#121826;color:#fff"><span style="flex:1;font-size:14px">มีหน้าจอเวอร์ชันใหม่ (${esc(S.updReady)})</span><button class="btn sm lime" data-a="applyupd">อัปเดตเลย</button></div></div>`;
  if (S.item) h += itemSheet(S.item);
  if (S.areaPick) h += areaPicker();
  if (S.search && !S.item) h += searchSheet();
  h += dupSyncPop();
  if (S.othPop && S.mode === 'app' && !S.dupPop) {
    const a = master.get(S.othPop.code),
      s = compute().cur.get(S.othPop.code);
    if (a && s) {
      const D = (d, l) =>
        `<button class="btn sm ${s.dec === d ? 'oth' : ''}" data-a="popdec" data-d="${d}" data-v="${esc(s.code)}" aria-pressed="${s.dec === d}">${l}</button>`;
      h += `<div class="dupbg" data-a="closeoth" role="alertdialog" aria-labelledby="othH"><div class="duppop oth" data-stop="1"><span class="dupicon" aria-hidden="true">!</span><b id="othH">ไม่ตรงพื้นที่</b><span class="mono" style="font-size:20px;font-weight:700">${esc(s.code)}</span><span>${esc(a.name)}</span>${S.othPop.also?.length > 1 ? `<span class="sub">คำตอบนี้ใช้กับทั้ง ${S.othPop.also.length} รายการย่อย (Sub) ที่เพิ่งนับ</span>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;margin:6px 0"><div class="card" style="padding:8px;gap:0;background:#f4f5fa"><span class="sub">ทะเบียน</span><b>${esc(a.ccName)}</b><span class="sub mono">CC ${esc(a.cc)}</span></div><div class="card" style="padding:8px;gap:0;background:var(--oth-soft)"><span class="sub">คุณอยู่ที่</span><b>${esc(s.areaName)}</b><span class="sub mono">CC ${esc(s.area)}</span></div></div>
        <span class="sub">บันทึกว่าพบแล้ว · โปรดระบุเหตุผล</span><div class="chips" style="justify-content:center">${D('moved', 'ต้องการย้าย')}${D('borrowed', 'ยืมมา')}${D('unsure', 'รอตรวจสอบ')}</div>
        <button class="btn dark" data-a="closeoth" style="align-self:stretch">ตกลง</button></div></div>`;
    }
  }
  if (S.dupPop && S.mode === 'app') {
    const d = S.dupPop,
      a = master.get(d.code);
    h += `<div class="dupbg" data-a="closedup" role="alertdialog" aria-labelledby="dupH"><div class="duppop"><span class="dupicon" aria-hidden="true">!</span><b id="dupH">ตรวจนับซ้ำ</b><span class="mono" style="font-size:20px;font-weight:700">${esc(d.code)}</span>${a ? `<span>${esc(a.name)}</span>` : ''}<span class="sub">นับไปแล้วโดย ${esc(d.by)} · ${hm(d.t)}${d.where ? ' · ' + esc(d.where) : ''}</span><button class="btn dark" data-a="closedup" style="align-self:stretch">ตกลง</button></div></div>`;
  }
  h += subPopup();
  return h;
}
function appLogin() {
  const team = meta?.team || [];
  return `<div class="pbody"><div class="brand"><img src="logo.svg" alt="Innovative Passionately"><b>AssetSync</b><span>เลือกชื่อของคุณเพื่อเริ่มนับ</span></div>
    ${team.length ? team.map((u, i) => `<button class="li" data-a="login" data-v="${i}"><span class="dot" style="background:${u.role === 'lead' ? 'var(--blue)' : 'var(--orange)'};color:${u.role === 'lead' ? '#fff' : '#1d0e00'}">${esc(u.name.slice(0, 1))}</span><span class="t"><b>${esc(u.name)}</b><span>${u.role === 'lead' ? 'Admin' : 'ผู้ตรวจนับ'}</span></span></button>`).join('') : `<div class="card"><p class="sub">ยังไม่มีรายชื่อทีม Admin เพิ่มได้ที่เมนู 6.2 User บนคอมพิวเตอร์ หรือใส่ชื่อทดสอบด้านล่าง</p></div>`}
    <div class="card"><label class="f">หรือพิมพ์ชื่อ<input class="in" id="loginName" placeholder="ชื่อของคุณ"></label><button class="btn pri" data-a="loginname">เข้าใช้งาน</button></div>
    <p class="sub">โหมดสาย USB · เลือกชื่อจากแพ็กเกจที่นำเข้า · เครื่องนี้: ${esc(dev)}</p></div>`;
}
function myAreas() {
  return (meta.areas || []).filter(a => a.assignee === S.user.name);
}
function appHome(c) {
  const st = areaStats(),
    T = totals(),
    { cur } = compute();
  const mineN = [...cur.values()].filter(x => x.by === S.user.name).length;
  let h = `<div class="pbody"><div class="row" style="align-items:center"><span class="dot" style="width:44px;height:44px;background:var(--orange);color:#1d0e00">${esc(S.user.name.slice(0, 1))}</span><span style="flex:1"><span class="sub">สวัสดี</span><br><b style="font-size:18px">${esc(S.user.name)}</b></span></div>`;
  if (meta.status === 'closed') h += `<div class="msg ok">Admin ปิดรอบตรวจนับแล้ว ขอบคุณสำหรับความร่วมมือ</div>`;
  h += `<div class="hero"><span style="font-size:13px;color:#d6ddff">${esc(meta.name)}</span><div><b style="font-size:42px;line-height:1">${N(T.found)}</b> <span style="font-size:17px;color:#d6ddff">/ ${N(T.total)} รายการ</span></div><div class="bar" style="background:#2e46c9"><i style="width:${T.total ? (T.found / T.total) * 100 : 0}%;background:var(--lime)"></i></div><span style="font-size:13px;color:#d6ddff">ทั้งทีมตรวจนับแล้ว ${T.total ? Math.round((T.found / T.total) * 100) : 0}% · คุณตรวจนับ ${N(mineN)} รายการ</span></div>
    ${
      jobList().filter(j => j.status !== 'closed').length > 1
        ? `<div class="card" style="gap:6px;padding:12px"><span class="sub">งานที่นับอยู่ (แตะเพื่อสลับ)</span><div class="chips">${jobList()
            .filter(j => j.status !== 'closed')
            .map(
              j =>
                `<button class="tog" aria-pressed="${j.id === meta.id}" data-a="pickjob" data-v="${esc(j.id)}">${j.id === meta.id ? '✓ ' : ''}${esc(j.name)}</button>`
            )
            .join('')}</div></div>`
        : ''
    }
    <b style="font-size:18px">เลือก Cost Center ที่จะนับ</b><input class="in" id="areaQ" value="${esc(S.areaQ || '')}" placeholder="ค้นหาชื่อ หรือรหัส CC" aria-label="ค้นหา Cost Center">`;
  const list = (meta.areas || []).slice().sort((a, b) => {
    const pa = st.get(String(a.code)),
      pb = st.get(String(b.code));
    const da = pa && pa.total && pa.found >= pa.total,
      dbb = pb && pb.total && pb.found >= pb.total;
    const ca = !!ccClosed(a.code),
      cb = !!ccClosed(b.code);
    return ca - cb || da - dbb || a.name.localeCompare(b.name);
  });
  for (const a of areaFilter(list)) h += areaCard(a, st.get(String(a.code)));
  return h + `</div>`;
}
function areaCard(a, x) {
  const p = x && x.total ? x.found / x.total : 0,
    dn = !a.shared && ccClosed(a.code);
  return `<button class="card" data-a="setarea" data-v="${esc(a.code)}" style="border:none;text-align:left;color:inherit;gap:8px"><div class="row" style="justify-content:space-between"><span style="display:flex;flex-direction:column;min-width:0"><b style="font-size:17px">${esc(a.name)}</b>${!a.shared && a.name !== String(a.code) ? `<span class="sub mono">CC ${esc(a.code)}</span>` : ''}</span><span style="display:flex;gap:4px;flex:none">${dn ? '<span class="chip c-ok">✓ ปิดแล้ว</span>' : ''}<span class="chip ${p >= 1 ? 'c-ok' : p > 0 ? 'c-warn' : 'c-gray'}">${a.shared ? 'ส่วนกลาง' : Math.round(p * 100) + '%'}</span></span></div>${a.shared ? '' : `<div class="bar"><i style="width:${p * 100}%;background:var(--ok)"></i></div>`}<span class="sub">${a.shared ? `สแกนแล้ว ${x?.here || 0}` : `${N(x?.found || 0)} / ${N(x?.total || 0)}`}${x?.other ? ` · พบทรัพย์สินของแผนกอื่น ${x.other}` : ''}</span></button>`;
}
const areaFilter = list => {
  const q = norm(S.areaQ || '');
  return q ? list.filter(a => norm(a.name).includes(q) || norm(a.code).includes(q)) : list;
};
function areaPicker() {
  const st = areaStats();
  return `<div class="sheetbg" data-a="closepick"><div class="sheet" data-stop="1"><div class="row" style="justify-content:space-between"><h2>ตอนนี้คุณอยู่ที่ไหน?</h2><button class="btn sm" data-a="closepick">ปิด</button></div><p class="sub">เลือกชื่อ Cost Center ที่ยืนนับอยู่จริง · สแกนทรัพย์สินของ CC ใดก็ได้ หากไม่ตรงระบบจะแจ้งเตือน</p>
    <input class="in" id="areaQ" value="${esc(S.areaQ || '')}" placeholder="ค้นหาชื่อ หรือรหัส CC" aria-label="ค้นหา Cost Center">
    ${
      areaFilter(meta.areas || [])
        .map(a => areaCard(a, st.get(String(a.code))))
        .join('') || '<p class="sub">ไม่พบ CC</p>'
    }</div></div>`;
}
// the department chosen last time must belong to the current round, otherwise ask again
function checkArea() {
  if (S.area && !(meta?.areas || []).some(a => String(a.code) === String(S.area.code))) {
    S.area = null;
    LS.set('area', null);
  }
  return S.area;
}
function appArea() {
  checkArea();
  if (!S.area)
    return `<div class="pbody"><div class="card"><h2>ยังไม่ได้เลือกพื้นที่</h2><button class="btn pri" data-a="areapick">เลือกพื้นที่ที่อยู่ตอนนี้</button></div></div>`;
  const { cur, recount } = compute(),
    code = String(S.area.code);
  const left = S.area.shared
    ? []
    : [...master.values()].filter(a => counted(a) && String(a.cc) === code && !cur.has(a.code));
  const foundHere = [...cur.values()].filter(s => String(s.area) === code);
  const own = foundHere.filter(s => !isOther(s)),
    oth = foundHere.filter(s => isOther(s));
  // own items found elsewhere
  const elsewhere = new Map();
  for (const s of cur.values()) {
    const a = master.get(s.code);
    if (a && String(a.cc) === code && String(s.area) !== code) elsewhere.set(s.code, s.areaName);
  }
  const list = S.areaTab === 'left' ? left : S.areaTab === 'found' ? own : oth;
  let h = `<div class="areahead dark"><div class="row" style="align-items:center"><span style="flex:1"><span style="font-size:12px;color:var(--lime);font-weight:600">คุณอยู่ที่นี่</span><br><b style="font-size:21px">${esc(S.area.name)}</b>${S.area.shared ? '' : ` <span class="mono" style="font-size:13px;color:#c7cbd4">${esc(code)}</span>`}</span><button class="btn sm lime" data-a="areapick">เปลี่ยน</button></div>
    <label class="f" style="color:#c7cbd4">ห้อง / จุดย่อย<input class="in" id="roomIn" value="${esc(S.room)}" placeholder="เช่น ห้องธุรการ ชั้น 2" style="background:#2a3242;border-color:#2a3242;color:#fff"></label>
    <div class="cnt3"><button data-a="areatab" data-v="found" style="background:var(--ok);color:#fff"><b>${own.length}</b><span style="font-size:12px">พบแล้ว</span></button><button data-a="areatab" data-v="left" style="background:var(--warn);color:#1d0e00"><b>${S.area.shared ? '—' : left.length}</b><span style="font-size:12px">ยังไม่พบ</span></button><button data-a="areatab" data-v="other" style="background:var(--oth);color:#fff"><b>${oth.length}</b><span style="font-size:12px">ของแผนกอื่น</span></button></div></div>
    <div class="pbody"><div class="tabs3">${[
      ['left', 'ยังไม่พบ'],
      ['found', 'พบแล้ว'],
      ['other', 'แผนกอื่น']
    ]
      .map(([k, l]) => `<button class="${S.areaTab === k ? 'on' : ''}" data-a="areatab" data-v="${k}">${l}</button>`)
      .join('')}</div>`;
  for (const x of list.slice(0, 80)) {
    const c2 = x.code,
      a = master.get(c2);
    h += `<button class="li" data-a="openitem" data-v="${esc(c2)}"><span class="t"><b class="mono">${esc(c2)}</b><span>${esc(a?.name || x.uname || '')}${a?.raws?.length > 1 ? ` · ${a.raws.length} รายการย่อย` : ''}${elsewhere.has(c2) ? ` · <b style="color:var(--oth-ink)">พบที่ ${esc(elsewhere.get(c2))}</b>` : ''}${recount.has(c2) ? ' · <b style="color:var(--warn-ink)">สั่งตรวจนับซ้ำ</b>' : ''}${S.areaTab === 'left' && lostOf(c2) ? ' · <b style="color:var(--bad-ink)">สูญหาย</b>' : ''}${S.areaTab === 'other' ? ` · ของ ${esc(a?.ccName)}` : ''}</span></span></button>`;
  }
  if (list.length > 80) h += `<p class="sub" style="text-align:center">+ อีก ${list.length - 80} รายการ</p>`;
  if (!list.length) h += `<p class="sub" style="text-align:center">ไม่มีรายการ</p>`;
  const dn = S.area.shared ? null : ccClosed(code);
  if (dn)
    h += `<div class="msg ok" style="display:flex;flex-direction:column;gap:6px"><b>✓ CC นี้นับครบแล้ว</b><span>${closeTxt(dn)}</span><button class="btn sm" data-a="ccreopen" data-v="${esc(code)}" style="align-self:flex-start">เปิดนับต่อ</button></div>`;
  else {
    h += `<button class="btn lime" data-a="app" data-v="scan" style="font-size:17px;padding:14px">สแกนในพื้นที่นี้</button>`;
    if (!S.area.shared)
      h +=
        S.confirmClose === code
          ? `<div class="confirm"><b>ปิดงาน CC ${esc(S.area.name)}?</b><span>${left.length ? `ยังไม่พบ <b>${left.length}</b> รายการ · ระบบจะบันทึกว่า "ไม่พบ" ให้ Admin ตัดสินต่อ` : 'พบครบทุกรายการแล้ว'}</span><div class="row"><button class="btn pri" data-a="ccclose" data-v="${esc(code)}" data-n="${left.length}">ยืนยัน นับครบแล้ว</button><button class="btn" data-a="noclose">ยกเลิก</button></div></div>`
          : `<button class="btn dark" data-a="askclose" data-v="${esc(code)}">✓ ปิดงาน CC นี้ (นับครบแล้ว)</button>`;
  }
  h += `</div>`;
  return h;
}
function appScan() {
  if (!checkArea()) {
    S.app = 'area';
    return appArea();
  }
  if (!S.area.shared && ccClosed(S.area.code)) {
    S.app = 'area';
    flash('CC นี้ปิดงานแล้ว · กด "เปิดนับต่อ" ถ้าจะนับเพิ่ม');
    return appArea();
  }
  const closed = meta.status === 'closed',
    { cur } = compute(),
    st = areaStats().get(String(S.area.code));
  let h = `<div class="areahead dark"><div class="row" style="align-items:center"><span style="flex:1"><span style="font-size:12px;color:#c7cbd4">กำลังนับที่ (แผนกที่ยืนอยู่จริง)</span><br><b style="font-size:20px">${esc(S.area.name)}${S.room ? ' · ' + esc(S.room) : ''}</b></span><span style="color:var(--lime);font-weight:600">${S.area.shared ? '' : `${st?.found || 0}/${st?.total || 0}`}</span><button class="btn sm lime" data-a="areapick" style="margin-left:8px">เปลี่ยน</button></div>
    <form class="scanbox" id="scanForm" autocomplete="off"><b style="color:var(--lime)">${closed ? 'รอบนี้ปิดแล้ว' : S.manual ? 'พิมพ์รหัสแล้วกด Enter' : 'พร้อมสแกน · กดปุ่มสแกนด้านข้างเครื่อง'}</b>
    <input id="scanIn" ${S.manual ? 'inputmode="text"' : 'inputmode="none"'} placeholder="${S.manual ? 'เลข Asset' : 'สแกนสติกเกอร์ QR / บาร์โค้ด'}" aria-label="รหัสที่สแกน" enterkeyhint="done" ${closed ? 'disabled' : ''}>
    <span style="font-size:12px;color:#c7cbd4">สแกนต่อได้ทันที ไม่ต้องกดบันทึก · บนคอมพิวเตอร์พิมพ์รหัสแล้ว Enter ได้</span></form></div><div class="pbody">`;
  for (const card of S.cards.slice(0, 25)) {
    const s = cur.get(card.code),
      a = master.get(card.code);
    if (card.dup) {
      h += `<div class="rcard"><div class="row" style="align-items:center"><span class="dot" style="background:var(--warn);color:#1d0e00">2</span><span class="t" style="flex:1;display:flex;flex-direction:column"><b class="mono">${esc(card.code)}</b><span class="sub" style="color:var(--warn-ink)">นับซ้ำ · ${esc(card.dupBy)} นับไปแล้ว ${hm(card.dupT)}</span></span><button class="btn sm" data-a="openitem" data-v="${esc(card.code)}">แก้ไข</button></div></div>`;
      continue;
    }
    if (!s) {
      h += `<div class="rcard" style="opacity:.6"><b class="mono">${esc(card.code)}</b><span class="sub">ยกเลิกแล้ว</span></div>`;
      continue;
    }
    const tick =
      pendingCount() && mine.some(e => e.code === card.code && !isServer(e.id))
        ? '<span class="chip c-warn">รอส่ง</span>'
        : db
          ? '<span class="chip c-ok">✓✓</span>'
          : '';
    if (!a) {
      h += `<div class="rcard unk"><div class="row" style="align-items:center"><span class="dot" style="background:var(--bad)">?</span><span style="flex:1;display:flex;flex-direction:column"><b class="mono">${esc(card.code)}</b><span class="sub" style="color:var(--bad-ink)">ไม่อยู่ในทะเบียน</span></span>${tick}</div>
        <div class="row"><input class="in" id="un-${esc(card.code)}" value="${esc(s.uname)}" placeholder="ชื่อ / ลักษณะของ" style="flex:1"><button class="btn sm" data-a="uname" data-v="${esc(card.code)}">บันทึก</button></div><div class="row"><button class="btn sm red" data-a="undo" data-v="${esc(card.code)}">ข้าม (สแกนผิดพลาด)</button></div></div>`;
    } else if (isOther(s)) {
      const D = (d, l) =>
        `<button class="btn sm ${s.dec === d ? 'oth' : ''}" data-a="dec" data-d="${d}" data-v="${esc(card.code)}" aria-pressed="${s.dec === d}">${l}</button>`;
      h += `<div class="rcard oth"><div class="row" style="justify-content:space-between;align-items:center"><b class="mono">${esc(card.code)}</b><span class="chip c-oth">ทะเบียน CC ${esc(a.cc)}</span>${tick}</div><span style="font-size:14px">${esc(a.name)}</span><span class="sub" style="color:var(--oth-ink)">ทะเบียนอยู่ CC ${esc(a.cc)} แต่พบที่ ${esc(s.areaName)} (แผนกที่คุณเลือก) · โปรดระบุเหตุผล</span><div class="chips">${D('moved', 'ต้องการย้าย')}${D('borrowed', 'ยืมมา')}${D('unsure', 'รอตรวจสอบ')}<button class="btn sm" data-a="openitem" data-v="${esc(card.code)}">รายละเอียด</button></div></div>`;
    } else {
      h += `<button class="rcard" data-a="openitem" data-v="${esc(card.code)}" style="border:none;text-align:left;flex-direction:row;align-items:center;gap:12px"><span class="dot" style="background:var(--ok)">✓</span><span style="flex:1;display:flex;flex-direction:column;min-width:0"><b class="mono">${esc(card.code)}</b><span class="sub">${esc(a.name)} · ${esc(s.cond)}${a.raws.length > 1 ? ` · ${a.raws.length} รายการย่อย` : ''}</span><span>${srcChip(s)}${s.src === 'qr' ? ' <span class="chip c-ok">ครบ</span>' : ''}</span>${s.dev !== dev && (compute().dups.get(card.code) || []).some(d => d.dev === dev) ? `<span class="sub" style="color:var(--warn-ink)">⚠ ${esc(s.by)} นับไปก่อนแล้ว ${hm(s.t)} (ขณะอินเทอร์เน็ตขาดการเชื่อมต่อ) · ไม่นับซ้ำ</span>` : ''}${!s.shared && a.ccName !== s.areaName && a.ccName !== String(a.cc) ? `<span class="sub" style="color:var(--warn-ink)">⚠ CC ตรง แต่ชื่อในทะเบียนเป็น "${esc(a.ccName)}"</span>` : ''}</span>${tick}</button>`;
    }
  }
  if (!S.cards.length)
    h += `<p class="sub" style="text-align:center">ผลการสแกนจะแสดงเป็นการ์ดที่นี่<br>ไม่มีสติกเกอร์? กดปุ่มด้านล่างเพื่อค้นหารายการ</p>`;
  h += `<button class="btn" data-a="opensearch" style="border-style:dashed">ไม่มีสติกเกอร์? ค้นหารายการ</button></div>`;
  return h;
}
let _srvIds = null,
  _srvRef = null;
const isServer = id => {
  if (_srvRef !== serverEv) {
    _srvRef = serverEv;
    _srvIds = new Set();
    for (const k in serverEv) for (const e of serverEv[k]) _srvIds.add(e.id);
  }
  return _srvIds.has(id);
};
function itemSheet(code) {
  const { cur, hist } = compute(),
    s = cur.get(code),
    a = master.get(code);
  let h = `<div class="sheetbg" data-a="closeitem"><div class="sheet" data-stop="1"><div class="sticker"><canvas id="itemSticker" width="560" height="296" aria-label="ป้ายดิจิทัล ${esc(code)}"></canvas></div>
    <div class="row" style="justify-content:space-between;align-items:center"><b style="font-size:17px">${esc(a?.name || s?.uname || code)}</b>${s ? badge(s) : '<span class="chip c-warn">ยังไม่พบ</span>'}</div>`;
  if (a)
    h += `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><div class="card" style="padding:10px 12px;gap:0"><span class="sub">ในทะเบียน</span><b>${esc(a.ccName)}</b></div><div class="card" style="padding:10px 12px;gap:0;background:${s && isOther(s) ? 'var(--oth-soft)' : s ? 'var(--ok-soft)' : '#fff'}"><span class="sub">พบที่</span><b>${s ? esc(s.areaName) : '—'}</b></div></div>`;
  if (s) {
    h += `<span class="sub">สภาพ</span><div class="cond">${['ปกติ', 'ชำรุด', 'รอซ่อม', 'ไม่ใช้งาน'].map(x => `<button class="${x === 'ปกติ' ? '' : 'w'}" aria-pressed="${s.cond === x}" data-a="cond" data-c="${x}" data-v="${esc(code)}">${x}</button>`).join('')}</div>
      <span class="sub">ป้าย + การโอนย้าย (เลือกได้หลายข้อ)</span><div class="chips">${flagChips(s, 'appflag')}</div>
      <div class="row"><input class="in" id="remarkIn" value="${esc(s.remark)}" placeholder="Remark" style="flex:1"><button class="btn sm" data-a="remark" data-v="${esc(code)}">บันทึก</button></div>
      <p class="sub">นับโดย ${esc(s.by)} · ${fmtT(s.t)}${s.room ? ' · ' + esc(s.room) : ''} · ${SRC[s.src][0]}${a && hasQR(s) ? ' · มี QR แล้ว' : ''}</p>
      <div class="row"><button class="btn dark" data-a="closeitem" style="flex:1">เสร็จสิ้น</button>${s.dev === dev ? `<button class="btn red" data-a="undo" data-v="${esc(code)}">ยกเลิกผลนับ</button>` : ''}</div>`;
  } else {
    h += `<p class="sub">ยังไม่มีใครสแกนรายการนี้${(hist.get(code) || []).length ? ' (เคยถูกยกเลิก / สั่งตรวจนับซ้ำ)' : ''}</p>${markChoices(code, 'markas')}<button class="btn" data-a="closeitem">ปิด</button>`;
  }
  return h + `</div></div>`;
}
function appFeed() {
  const { cur } = compute();
  let list = [...cur.values()].filter(s => s.by === S.user.name).sort((a, b) => b.t - a.t);
  const today = new Date().toDateString(),
    nToday = list.filter(s => new Date(s.t).toDateString() === today).length,
    nRe = list.filter(s => s.flags.reprint || s.flags.namebad).length;
  if (S.feedF === 'pending') list = list.filter(s => mine.some(e => e.code === s.code && !isServer(e.id)));
  if (S.feedF === 'other') list = list.filter(isOther);
  if (S.feedF === 'dmg') list = list.filter(s => s.cond !== 'ปกติ');
  let h = `<div class="pbody"><b style="font-size:23px">สมุดสติกเกอร์</b><div class="cnt3 dark" style="border-radius:20px;padding:12px"><div><b style="color:var(--lime)">${cur.size ? [...cur.values()].filter(s => s.by === S.user.name).length : 0}</b><span style="font-size:12px;color:#c7cbd4">สะสมแล้ว</span></div><div><b>${nToday}</b><span style="font-size:12px;color:#c7cbd4">วันนี้</span></div><div><b>${nRe}</b><span style="font-size:12px;color:#c7cbd4">ป้ายต้องพิมพ์ใหม่</span></div></div>
    <div class="chips">${[
      ['all', 'ทั้งหมด'],
      ['pending', 'รอส่ง'],
      ['other', 'ของแผนกอื่น'],
      ['dmg', 'ชำรุด']
    ]
      .map(([k, l]) => `<button class="tog" aria-pressed="${S.feedF === k}" data-a="feedf" data-v="${k}">${l}</button>`)
      .join('')}</div><div class="book">`;
  for (const s of list.slice(0, 120)) {
    const a = master.get(s.code),
      col = !a ? 'var(--bad)' : isOther(s) ? 'var(--oth)' : s.cond !== 'ปกติ' ? 'var(--warn)' : 'var(--ok)';
    h += `<button class="mini" data-a="openitem" data-v="${esc(s.code)}" style="border-top-color:${col}"><b>${esc(s.code)}</b><span>${esc(a?.name || s.uname || 'ไม่อยู่ในทะเบียน')}</span><span class="sub" style="font-size:11px">${esc(s.areaName)} · ${hm(s.t)}</span></button>`;
  }
  h += `</div>${list.length ? '' : '<p class="sub" style="text-align:center">ยังไม่มีรายการ</p>'}</div>`;
  return h;
}
// step-by-step scanner setup, with shortcuts the Android app can open directly
function scannerSetup() {
  const B = window.AndroidBridge,
    conf = (() => {
      try {
        return B?.scannerConflicts ? JSON.parse(B.scannerConflicts()) : [];
      } catch {
        return [];
      }
    })();
  const st = (n, t, d) =>
    `<div class="row" style="align-items:flex-start;gap:10px"><span class="dot" style="width:26px;height:26px;flex:none;background:var(--blue);color:#fff;font-size:13px">${n}</span><span style="flex:1"><b>${t}</b><br><span class="sub">${d}</span></span></div>`;
  let h = `<div class="card"><b>ตั้งค่าเครื่องสแกน CipherLab</b><p class="sub">สแกน QR ไม่เข้า ทำตามนี้ทีละข้อ แล้วลองยิงที่การ์ด "ทดสอบปุ่มสแกน"</p>`;
  h += conf.length
    ? `<div class="msg warn">พบแอปที่อาจแย่งหัวอ่าน: ${conf.map(c => `<b>${esc(c.label)}</b>`).join(', ')} · กด Force stop หรือ Uninstall</div><div class="chips">${conf.map(c => `<button class="btn sm red" data-a="appinfo" data-v="${esc(c.pkg)}">เปิด ${esc(c.label)}</button>`).join('')}</div>`
    : st(
        1,
        'ปิดแอป AMS ตัวเก่า',
        B?.scannerConflicts ? 'ไม่พบแอปที่แย่งหัวอ่าน ✓' : 'ตั้งค่า → แอป → AMS ตัวเก่า → Force stop / Uninstall'
      );
  h +=
    st(
      2,
      'ReaderConfig → โปรไฟล์ Default',
      'ตั้งค่าที่โปรไฟล์ Default (หรือสร้างโปรไฟล์ใหม่ Associated App = AssetSync)'
    ) +
    st(
      3,
      'Data Output → Keyboard Emulation = KeyEvent',
      'ห้ามเป็น None · Auto Enter Character = Decoded data + Enter char'
    ) +
    st(4, 'Symbology → เปิด QR Code', 'และ Code 128 สำหรับบาร์โค้ดเดิม') +
    st(
      5,
      'Data Output → ติ๊ก Display Code Type',
      'ใช้แยก "สแกน QR" กับ "สแกนบาร์โค้ด" · ไม่ต้องติ๊ก Display Code Length (บางรุ่นเป็นเมนู Code ID = AIM)'
    );
  if (B?.openReaderConfig) h += `<button class="btn pri" data-a="openrc">เปิด ReaderConfig</button>`;
  return h + `</div>`;
}
function appMeBlock() {
  const mineSent = db ? mine.filter(e => isServer(e.id)).length : mine.length,
    p = pendingCount();
  return `<div class="card"><div class="row" style="align-items:center"><span class="dot" style="width:48px;height:48px;background:var(--orange);color:#1d0e00">${esc(S.user?.name?.slice(0, 1) || '?')}</span><span style="flex:1"><b style="font-size:19px">${esc(S.user?.name || '-')}</b><br><span class="sub">เครื่อง ${esc(dev)}</span></span></div></div>
    ${usbCard()}
    ${
      usbMode
        ? ''
        : `<div class="card"><b>การซิงก์</b>${db ? '' : '<p class="sub">ยังไม่ได้เชื่อมต่อระบบ (ไม่มีอินเทอร์เน็ต?) · ผลนับเก็บในเครื่องไว้ก่อน</p>'}<div class="cnt3"><div style="background:#f4f5fa"><b>${mine.length}</b><span style="font-size:11px">ในเครื่อง</span></div><div style="background:var(--ok-soft);color:var(--ok-ink)"><b>${mineSent}</b><span style="font-size:11px">ถึงระบบ ✓✓</span></div><div style="background:var(--warn-soft);color:var(--warn-ink)"><b>${p}</b><span style="font-size:11px">รอส่ง</span></div></div>
    <button class="btn pri" data-a="verify">ส่งข้อมูลและตรวจสอบ</button>${S.verify ? `<div class="msg ${S.verify[1]}">${esc(S.verify[0])}</div>` : ''}</div>`
    }
    <div class="card"><b>เกี่ยวกับ</b><p class="sub">AssetSync ${esc(VER())}${window.AMS_BUILT ? ' (' + esc(window.AMS_BUILT) + ')' : ''}${window.AndroidBridge?.appVersion ? ' · แอป ' + esc(window.AndroidBridge.appVersion()) : ' · เว็บ'}${isLead() ? ' · ' + esc(Store.auth.config().url.replace(/^https:\/\//, '') || 'ยังไม่ตั้งค่า') : ''}</p>${window.AndroidBridge?.checkUpdate ? '<button class="btn sm" data-a="chkupd" style="align-self:flex-start">ตรวจหาอัปเดต</button>' : ''}${usbMode || !isLead() ? '' : '<button class="btn sm" data-a="editcfg" style="align-self:flex-start">ตั้งค่าการเชื่อมต่อ</button>'}</div>
    ${!isLead() ? '' : `<div class="card"><b>ทดสอบปุ่มสแกน</b><p class="sub">กดปุ่มสแกนที่สติกเกอร์ แล้วตรวจสอบว่ามีรายการแสดงด้านล่างหรือไม่</p>${scanLog.length ? scanLog.map(x => `<span class="sub mono">${hm(x.t)} · ${esc(x.how)} · ${esc(x.v)}</span>`).join('') : '<span class="sub">ยังไม่ได้รับอะไรจากปุ่มสแกน</span>'}<p class="sub">มีเสียงบี๊บแต่ไม่มีอะไรขึ้น = แอป AMS เดิมเปิดค้างอยู่และแย่งหัวอ่าน → ปัดแอปเดิมทิ้งจากหน้าแอปที่เปิดค้าง · ไม่มีบี๊บ = ตั้งค่า ReaderConfig (ด้านล่าง)</p></div>`}
    <button class="btn red" data-a="logout">ออกจากระบบ / เปลี่ยนคน</button>`;
}
// QR with the Asset only and several Subs in the register: count one Sub, or every Sub found here
function subPopup() {
  const p = S.subPop;
  if (!p || S.mode !== 'app') return '';
  const { cur } = compute(),
    left = p.keys.filter(k => !cur.has(k));
  const rowOf = k => {
    const a = master.get(k),
      s = cur.get(k);
    return `<div class="row" style="align-items:center;gap:8px;background:#f8f9fc;border-radius:12px;padding:8px 10px"><span style="flex:1;min-width:0"><b class="mono">${esc(fullCode(a))}</b> <span class="chip ${s ? 'c-ok' : 'c-gray'}">${s ? 'ตรวจแล้ว' : 'รอตรวจ'}</span><br><span class="sub">${esc(a.name)}${s ? ` · ${esc(s.by)} ${hm(s.t)}` : ''}</span></span>${s ? '' : `<button class="btn sm pri" data-a="subone" data-v="${esc(k)}">นับรายการนี้</button>`}</div>`;
  };
  return `<div class="dupbg" data-a="closesub" role="alertdialog" aria-labelledby="subH"><div class="duppop" data-stop="1" style="max-width:400px;align-items:stretch;text-align:left">
    <b id="subH" style="text-align:center">Asset นี้มี ${p.keys.length} รายการย่อย (Sub)</b><span class="mono" style="font-size:20px;font-weight:700;text-align:center">${esc(p.base)}</span>
    <span class="sub" style="text-align:center">สติกเกอร์นี้มีเฉพาะเลข Asset · โปรดเลือกรายการที่พบ ระบบจะนำรายการที่นับไปไว้ในรายการ "ป้าย QR รูปแบบเก่า" เพื่อพิมพ์ป้ายใหม่</span>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:42vh;overflow-y:auto">${p.keys.map(rowOf).join('')}</div>
    ${left.length ? `<button class="btn pri" data-a="suball">พบทั้งหมด (${left.length} รายการ)</button>` : `<span class="sub" style="text-align:center">ทุกรายการตรวจนับแล้ว</span>`}<button class="btn" data-a="closesub">ยกเลิก</button></div></div>`;
}
function dupSyncPop() {
  const l = myDups();
  if (!l.length || S.dupSyncHide === l.length || S.mode !== 'app' || S.dupPop || S.othPop) return '';
  return `<div class="dupbg" role="alertdialog" aria-labelledby="dsH"><div class="duppop" data-stop="1" style="max-width:380px;align-items:stretch;text-align:left"><span class="dupicon" aria-hidden="true" style="align-self:center">!</span><b id="dsH" style="text-align:center">อินเทอร์เน็ตกลับมาแล้ว · พบรายการซ้ำ ${l.length} รายการ</b><span class="sub" style="text-align:center">ระหว่างที่อินเทอร์เน็ตขาดการเชื่อมต่อ มีเครื่องอื่นตรวจนับรายการเหล่านี้ไปก่อนแล้ว ระบบนับเพียงครั้งเดียว</span>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:40vh;overflow-y:auto">${l.map(d => `<div class="row" style="align-items:center;gap:8px;background:#f8f9fc;border-radius:12px;padding:8px 10px"><span style="flex:1;min-width:0"><b class="mono">${esc(d.code)}</b><br><span class="sub">${esc(master.get(d.code)?.name || '')} · ${esc(d.first?.by || '')} นับก่อน ${d.first ? hm(d.first.t) : ''} ที่ ${esc(d.first?.areaName || '')}</span></span><button class="btn sm red" data-a="dupdrop" data-v="${esc(d.code)}" data-id="${esc(d.id)}">ลบ</button></div>`).join('')}</div>
    <button class="btn red" data-a="dupdropall">ลบรายการซ้ำทั้งหมด (${l.length})</button><button class="btn" data-a="duplater">ภายหลัง</button></div></div>`;
}
