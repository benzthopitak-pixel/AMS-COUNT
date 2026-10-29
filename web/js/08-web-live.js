/* AssetSync · เมนู 2 รายการตรวจนับ: ภาพรวมทุก CC, Dashboard และหน้าของแต่ละ CC */
function areaStats() {
  const { cur } = compute(),
    st = new Map();
  for (const a of meta.areas || []) st.set(String(a.code), { ...a, total: 0, found: 0, other: 0, here: 0 });
  for (const a of master.values()) {
    if (!counted(a)) continue;
    const x = st.get(String(a.cc));
    if (!x) continue;
    x.total++;
    if (cur.has(a.code)) x.found++;
  }
  for (const s of cur.values()) {
    const x = st.get(String(s.area));
    if (!x) continue;
    x.here++;
    if (isMoveCase(s)) x.other++;
  }
  return st;
}
function webLive(c) {
  // overview: one row per Cost Center → tap to open that CC's own page
  const T = totals(),
    { cur } = compute(),
    st = areaStats();
  const out = new Map(),
    unkHere = new Map(),
    dec = new Map();
  for (const s2 of cur.values()) {
    const a = master.get(s2.code);
    if (a && isMoveCase(s2)) out.set(String(a.cc), (out.get(String(a.cc)) || 0) + 1);
    if (!a) unkHere.set(String(s2.area), (unkHere.get(String(s2.area)) || 0) + 1);
    if (needsDecision(s2)) dec.set(String(s2.area), (dec.get(String(s2.area)) || 0) + 1);
  }
  const q = '';
  let rows = [...st.values()].filter(x => !q || norm(x.code).includes(q) || norm(x.name).includes(q));
  const sorters = {
    code: (a, b) => String(a.code).localeCompare(String(b.code)),
    left: (a, b) => b.total - b.found - (a.total - a.found),
    pct: (a, b) => (a.total ? a.found / a.total : 1) - (b.total ? b.found / b.total : 1)
  };
  rows.sort(sorters[S.ccSort || 'code']);
  const decAll = [...dec.values()].reduce((x, y) => x + y, 0);
  let h = `<main class="wrap"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><p class="sub">${esc(meta.name)} · อัปเดตสด</p><h1>2 · รายการตรวจนับ</h1></div><button class="btn" data-a="opencc" data-v="*">ดูทุกรายการ →</button></div>`;
  h += `<div class="kpis"><button class="kpi" data-a="opencc" data-v="*" data-t="done" style="border:none;text-align:left;background:var(--ok);color:#fff"><span style="color:#fff">ตรวจแล้ว</span><b>${N(T.found)}</b><span style="color:#e7f8ef">จาก ${N(T.total)} · ${T.total ? Math.round((T.found / T.total) * 100) : 0}%</span></button>
    <button class="kpi" data-a="opencc" data-v="*" data-t="left" style="border:none;text-align:left"><span>รอตรวจ</span><b style="color:var(--warn-ink)">${N(T.left)}</b><span>ดูรายการ →</span></button>
    <button class="kpi" data-a="opencc" data-v="*" data-t="move" style="border:none;text-align:left"><span>ต้องย้าย CC</span><b style="color:var(--oth-ink)">${N(T.other)}</b><span>${decAll ? `รอตัดสิน ${decAll} เรื่อง →` : 'ดูรายการ →'}</span></button>
 <button class="kpi" data-a="opencc" data-v="*" data-t="borrow" style="border:none;text-align:left"><span>ยืมมา (ไม่ย้าย CC)</span><b style="color:var(--muted)">${N(T.borrow)}</b><span>ดูรายการ →</span></button>
    <button class="kpi" data-a="opencc" data-v="*" data-t="unk" style="border:none;text-align:left"><span>ไม่อยู่ในทะเบียน</span><b style="color:var(--bad-ink)">${N(T.unk)}</b><span>ดูรายการ →</span></button></div>`;
  h += `<div class="row pair"><section class="card grow"><div class="row" style="justify-content:space-between;align-items:center"><div><h2>Cost Center (${rows.length})</h2><span class="sub">สีเข้ม = นับใกล้ครบ · คลิกเพื่อดูรายละเอียด</span></div>
    <div class="row" style="align-items:center"><select class="in" id="ccPickSel" style="width:auto;max-width:260px" aria-label="เลือก Cost Center"><option value="">เลือก CC เพื่อเปิด…</option>${[
      ...st.values()
    ]
      .filter(x => !x.shared)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
      .map(
        x =>
          `<option value="${esc(x.code)}">${esc(x.code)}${x.name !== String(x.code) ? ' · ' + esc(x.name) : ''} (${x.total ? Math.round((x.found / x.total) * 100) : 0}%)</option>`
      )
      .join(
        ''
      )}</select><select class="in" id="ccSort" style="width:auto" aria-label="เรียงตาม"><option value="code" ${S.ccSort === 'code' || !S.ccSort ? 'selected' : ''}>เรียงตามรหัส</option><option value="left" ${S.ccSort === 'left' ? 'selected' : ''}>เหลือมากสุดก่อน</option><option value="pct" ${S.ccSort === 'pct' ? 'selected' : ''}>% น้อยสุดก่อน</option></select></div></div>
    <div class="grid" style="grid-auto-rows:1fr">`;
  for (const x of rows) {
    const r = x.total ? x.found / x.total : 0,
      p = Math.round(r * 100),
      mv = (out.get(String(x.code)) || 0) + x.other,
      d = dec.get(String(x.code)) || 0,
      u = unkHere.get(String(x.code)) || 0;
    const bg = r >= 1 ? '#12b76a' : r >= 0.66 ? '#6ce9a6' : r >= 0.33 ? '#a6f4c5' : r > 0 ? '#d1fadf' : '#f2f4f7';
    const fg = r >= 1 ? '#ffffff' : r > 0 ? '#053321' : '#344054';
    const flags = [
      mv ? `<span class="chip c-oth">ย้าย CC ${mv}</span>` : '',
      d ? `<span class="chip c-warn">รอตัดสิน ${d}</span>` : '',
      u ? `<span class="chip c-bad">นอกทะเบียน ${u}</span>` : '',
      ccNameDiff(x.code)
        ? '<span class="chip c-warn" title="ชื่อแผนกในไฟล์ไม่ตรงกัน · ยึดรหัส CC">⚠ ชื่อไม่ตรง</span>'
        : '',
      ccClosed(x.code)
        ? `<span class="chip" style="background:#121826;color:#fff" title="${closeTxt(ccClosed(x.code))}">✓ ปิดงานแล้ว</span>`
        : ''
    ].join('');
    h += `<button class="tile click" data-a="opencc" data-v="${esc(x.code)}" title="เปิดรายละเอียด ${esc(x.code)}" style="background:${bg};color:${fg};cursor:pointer"><b class="mono">${esc(x.code)}</b>${x.name !== String(x.code) ? `<small style="opacity:.85">${esc(x.name)}</small>` : ''}<span class="p">${p}%</span><small>ตรวจ ${N(x.found)}/${N(x.total)} · เหลือ ${N(x.total - x.found)}</small>${flags ? `<span style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${flags}</span>` : ''}</button>`;
  }
  h += `</div>${rows.length ? '' : '<p class="sub">ไม่พบ CC</p>'}</section><aside class="side" style="display:flex;flex-direction:column;gap:12px">`;
  h += teamPanel();
  const last = [...cur.values()].sort((a, b) => b.t - a.t).slice(0, 8);
  h += `<section class="card"><h2>สแกนล่าสุด</h2>${last.map(s2 => `<button class="li" data-a="openitemcc" data-v="${esc(s2.code)}" style="background:#f8f9fc"><span class="t"><b class="mono">${esc(s2.code)}</b><span>${esc(master.get(s2.code)?.name || s2.uname || 'ไม่อยู่ในทะเบียน')} · ${esc(s2.areaName)}</span></span>${badge(s2)}</button>`).join('') || '<p class="sub">—</p>'}</section></aside></div>`;
  return h + `</main>`;
}
// right panel: every device — online now?, counting which CC, how many items it counted · Admin first, then counters
// ---------- live dashboard (menu 2): one glance at progress, status, pace, people, method ----------
function dashboard() {
  const { cur, evs } = compute(),
    T = totals(),
    pct = T.total ? T.found / T.total : 0;
  const real = (meta.areas || []).filter(a => !a.shared),
    shut = real.filter(a => ccClosed(a.code)).length,
    onl = Object.keys(S.pres || {}).length || 1;
  // status of every register item
  let ok = 0,
    mv = 0,
    bw = 0,
    lost = 0,
    left = 0;
  for (const a of master.values()) {
    if (!counted(a)) continue;
    const s2 = cur.get(a.code);
    if (!s2) {
      if (lostOf(a.code)) lost++;
      else left++;
    } else if (isBorrowed(s2)) bw++;
    else if (isOther(s2)) mv++;
    else ok++;
  }
  const parts = [
    ['ตรวจแล้ว', ok, 'var(--ok)'],
    ['ต้องย้าย CC', mv, 'var(--oth)'],
    ['ยืมมา', bw, '#98a2b3'],
    ['สูญหาย', lost, 'var(--bad)'],
    ['ยังไม่พบ', left, '#e4e7ec']
  ];
  const tot = parts.reduce((x, p) => x + p[1], 0) || 1;
  // donut
  const R0 = 52,
    C = 2 * Math.PI * R0,
    dash = Math.max(0, Math.min(1, pct)) * C;
  const donut = `<svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="ตรวจแล้ว ${Math.round(pct * 100)}%"><circle cx="70" cy="70" r="${R0}" fill="none" stroke="#eef0f6" stroke-width="14"/><circle cx="70" cy="70" r="${R0}" fill="none" stroke="var(--ok)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${dash} ${C}" transform="rotate(-90 70 70)"><title>ตรวจแล้ว ${N(T.found)} จาก ${N(T.total)}</title></circle><text x="70" y="68" text-anchor="middle" font-size="26" font-weight="700" fill="var(--ink)">${Math.round(pct * 100)}%</text><text x="70" y="88" text-anchor="middle" font-size="11" fill="var(--muted)">${N(T.found)} / ${N(T.total)}</text></svg>`;
  // pace: scans per hour today
  const now = new Date(),
    day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    hours = Array(24).fill(0);
  for (const e of evs) if (e.k === 'scan' && e.t >= day0) hours[new Date(e.t).getHours()]++;
  let h0 = hours.findIndex(x => x),
    h1 = now.getHours();
  if (h0 < 0 || h0 > h1) h0 = Math.max(0, h1 - 7);
  if (h1 - h0 < 7) h0 = Math.max(0, h1 - 7);
  const hs = hours.slice(h0, h1 + 1),
    hmax = Math.max(1, ...hs),
    bw0 = 100 / hs.length,
    today = hs.reduce((a, b) => a + b, 0);
  const pace = `<svg viewBox="0 0 100 46" preserveAspectRatio="none" width="100%" height="120" role="img" aria-label="จำนวนสแกนรายชั่วโมงวันนี้">${hs.map((v, i) => `<rect x="${i * bw0 + bw0 * 0.15}" y="${40 - (v / hmax) * 36}" width="${bw0 * 0.7}" height="${Math.max(v ? 1 : 0, (v / hmax) * 36)}" rx="1" fill="var(--blue)"><title>${String(h0 + i).padStart(2, '0')}:00 · ${v} รายการ</title></rect>`).join('')}<line x1="0" y1="40" x2="100" y2="40" stroke="#e4e7ec" stroke-width=".4"/></svg>
    <div class="row" style="justify-content:space-between;font-size:11px;color:var(--muted);margin-top:-4px"><span>${String(h0).padStart(2, '0')}:00</span><span>${String(h1).padStart(2, '0')}:00</span></div>`;
  // people + method
  const by = new Map(),
    how = new Map();
  for (const s2 of cur.values()) {
    by.set(s2.by, (by.get(s2.by) || 0) + 1);
    how.set(s2.src, (how.get(s2.src) || 0) + 1);
  }
  const hbar = (rows, color) => {
    const mx = Math.max(1, ...rows.map(r => r[1]));
    return (
      rows
        .map(
          ([l, v, extra]) =>
            `<div class="hb" title="${esc(l)} · ${N(v)}"><span class="hb-l">${esc(l)}</span><span class="hb-t"><i style="width:${(v / mx) * 100}%;background:${color}"></i></span><b class="hb-v">${N(v)}${extra || ''}</b></div>`
        )
        .join('') || '<p class="sub">ยังไม่มีข้อมูล</p>'
    );
  };
  const people = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const method = Object.keys(SRC).map(k => [SRC[k][0], how.get(k) || 0]);
  // CC with the most left to count
  const st = areaStats(),
    behind = [...st.values()]
      .filter(x => x.total && !x.shared)
      .map(x => [
        x.name !== String(x.code) ? `${x.code} · ${x.name}` : String(x.code),
        x.total - x.found,
        ` <span class="sub">(${Math.round((x.found / x.total) * 100)}%)</span>`
      ])
      .filter(r => r[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  const lastT = evs.length ? Math.max(...evs.map(e => e.t)) : 0;
  return `<div class="dash">
    <section class="card dash-hero"><div class="row" style="justify-content:space-between;align-items:center"><h2>ความคืบหน้า</h2><span class="live"><i></i>สด${lastT ? ' · ล่าสุด ' + hm(lastT) : ''}</span></div>
      <div class="row" style="align-items:center;gap:18px;flex-wrap:nowrap">${donut}<div style="display:flex;flex-direction:column;gap:8px;min-width:0">
        <div><span class="sub">ปิดงานแล้ว</span><br><b style="font-size:22px">${shut}</b><span class="sub"> / ${real.length} CC</span></div>
        <div><span class="sub">สแกนวันนี้</span><br><b style="font-size:22px">${N(today)}</b><span class="sub"> รายการ</span></div>
        <div><span class="sub">ออนไลน์ตอนนี้</span><br><b style="font-size:22px">${onl}</b><span class="sub"> เครื่อง</span></div></div></div></section>
    <section class="card"><h2>สถานะทรัพย์สิน</h2><div class="stack" role="img" aria-label="สัดส่วนสถานะ">${parts
      .filter(p => p[1])
      .map(
        ([l, v, c]) =>
          `<i style="flex:${v};background:${c}" title="${l} ${N(v)} (${Math.round((v / tot) * 100)}%)"></i>`
      )
      .join('')}</div>
      <div class="legend">${parts.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l} <b>${N(v)}</b> <span class="sub">${Math.round((v / tot) * 100)}%</span></span>`).join('')}</div></section>
    <section class="card"><h2>สแกนรายชั่วโมง (วันนี้)</h2>${pace}</section>
    <section class="card"><h2>ผู้ตรวจนับ</h2>${hbar(people, 'var(--orange)')}</section>
    <section class="card"><h2>วิธีตรวจนับ</h2>${hbar(method, 'var(--blue)')}</section>
    <section class="card"><h2>CC ที่ยังเหลือมากที่สุด</h2>${hbar(behind, 'var(--warn)')}</section></div>`;
}
function teamPanel() {
  const { cur, evs } = compute(),
    devs = new Map(),
    now = Date.now();
  const roleOf = (name, r) =>
    r || S.team.find(u => u.name === name)?.role || (meta?.team || []).find(u => u.name === name)?.role || 'counter';
  for (const e of evs) {
    const d = devs.get(e.dev) || { dev: e.dev, by: e.by, n: 0, t: 0, area: null, areaName: null };
    d.t = Math.max(d.t, e.t);
    d.by = e.by;
    if (e.k === 'scan') {
      d.area = e.area;
      d.areaName = e.areaName;
    }
    devs.set(e.dev, d);
  }
  for (const s2 of cur.values()) {
    const d = devs.get(s2.dev);
    if (d) d.n++;
  }
  for (const [d, p] of Object.entries(S.pres || {})) {
    const x = devs.get(d) || { dev: d, by: p.by, n: 0, t: 0 };
    x.on = true;
    x.p = p;
    if (p.by) x.by = p.by;
    devs.set(d, x);
  }
  const me = devs.get(dev) || { dev, by: S.user?.name, n: 0, t: 0 };
  me.on = true;
  me.p = me.p || presState();
  devs.set(dev, me);
  const list = [...devs.values()]
    .map(x => ({ ...x, role: roleOf(x.by, x.p?.role) }))
    .sort((a, b) => (a.role !== 'lead') - (b.role !== 'lead') || (b.on || false) - (a.on || false) || b.n - a.n);
  const nOn = list.filter(x => x.on).length;
  let h = `<section class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2>ทีม / เครื่อง</h2><span class="chip c-ok">ออนไลน์ ${nOn}</span></div>`;
  for (const x of list) {
    const lead = x.role === 'lead',
      where =
        x.on && x.p
          ? x.p.mode === 'web'
            ? 'ใช้บนคอมพิวเตอร์'
            : x.p.areaName
              ? `กำลังนับ ${esc(x.p.areaName)}${x.p.area && x.p.areaName !== String(x.p.area) ? ` (${esc(x.p.area)})` : ''}`
              : 'ยังไม่เลือก CC'
          : x.areaName
            ? `ล่าสุดที่ ${esc(x.areaName)}`
            : '';
    h += `<div class="row" style="align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f0f2f5"><span class="dot" style="position:relative;flex:none;background:${lead ? 'var(--blue)' : '#e4e7ec'};color:${lead ? '#fff' : '#344054'}">${esc((x.by || '?').slice(0, 1))}<i style="position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;border:2px solid #fff;background:${x.on ? 'var(--ok)' : '#98a2b3'}" aria-label="${x.on ? 'ออนไลน์' : 'ออฟไลน์'}"></i></span>
      <span style="flex:1;min-width:0"><b>${esc(x.by || '?')}</b> <span class="chip ${lead ? 'c-blue' : 'c-gray'}" style="font-size:11px">${lead ? 'Admin' : 'ผู้ตรวจนับ'}</span><br><span class="sub">${x.on ? '<b style="color:var(--ok-ink)">ออนไลน์</b>' : `ออฟไลน์${x.t ? ' · ' + hm(x.t) : ''}`}${where ? ' · ' + where : ''}<br>เครื่อง ${esc(x.dev)}${x.dev === dev ? ' (เครื่องนี้)' : ''}</span></span>
      <span style="flex:none;min-width:54px;text-align:center;background:var(--orange);color:#1d0e00;border-radius:14px;padding:6px 8px;line-height:1.1"><b style="font-size:18px">${N(x.n)}</b><br><span style="font-size:11px">รายการ</span></span></div>`;
  }
  return h + `</section>`;
}
const needsDecision = s2 =>
  (!!compute().dups.get(s2.code) && !s2.rv.dup) ||
  (isOther(s2) && s2.dec !== 'borrowed' && !s2.rv.move) ||
  (!master.has(s2.code) && !s2.rv.unk) ||
  ((s2.cond === 'ชำรุด' || s2.cond === 'รอซ่อม') && !s2.rv.dmg);

/* ---------- one Cost Center: what's counted, what's left, what must move ---------- */
function ccRows(ccCode) {
  const { cur } = compute(),
    all = ccCode === '*',
    out = [];
  for (const a of master.values()) {
    if (!counted(a) || (!all && String(a.cc) !== ccCode)) continue;
    const s2 = cur.get(a.code);
    out.push({
      code: a.code,
      a,
      s: s2,
      state: !s2 ? (lostOf(a.code) ? 'lost' : 'left') : isBorrowed(s2) ? 'lentout' : isOther(s2) ? 'moveout' : 'done'
    });
  }
  for (const s2 of cur.values()) {
    const a = master.get(s2.code);
    if (!a) {
      if (all || String(s2.area) === ccCode) out.push({ code: s2.code, a: null, s: s2, state: 'unk' });
      continue;
    }
    if (!all && isOther(s2) && String(s2.area) === ccCode)
      out.push({ code: s2.code, a, s: s2, state: isBorrowed(s2) ? 'borrowin' : 'movein' });
  }
  return out;
}
const CC_TABS = [
  ['all', 'ทั้งหมด'],
  ['left', 'รอตรวจ'],
  ['done', 'ตรวจแล้ว'],
  ['move', 'ต้องย้าย CC'],
  ['borrow', 'ยืมมา'],
  ['unk', 'ไม่อยู่ในทะเบียน'],
  ['lost', 'สูญหาย'],
  ['dup', 'สแกนซ้ำ 2 เครื่อง'],
  ['noqr', 'ยังไม่มี QR']
];
const SRC_OPTS = [
  ['', 'ที่มา: ทั้งหมด'],
  ['scan', 'จากเครื่องสแกนทั้งหมด'],
  ['qr', 'สแกน QR'],
  ['barcode', 'สแกนบาร์โค้ด'],
  ['manual', 'พิมพ์ / ค้นหาบนเครื่อง'],
  ['web', 'บันทึกบนเว็บ']
];
function webCC() {
  const ccCode = S.ccSel,
    all = ccCode === '*',
    area = (meta.areas || []).find(x => String(x.code) === ccCode);
  if (SRC[S.ccTab] || S.ccTab === 'scan') {
    S.ccF = { ...(S.ccF || {}), src: S.ccTab };
    S.ccTab = 'all';
  }
  const rowsAll = ccRows(ccCode),
    tab = S.ccTab || 'all',
    q = norm(S.ccItemQ || ''),
    F = S.ccF || {};
  const n = {
    all: rowsAll.length,
    left: rowsAll.filter(r => r.state === 'left').length,
    done: rowsAll.filter(r => r.state === 'done').length,
    move: rowsAll.filter(r => r.state === 'moveout' || r.state === 'movein').length,
    borrow: rowsAll.filter(r => r.state === 'lentout' || r.state === 'borrowin').length,
    unk: rowsAll.filter(r => r.state === 'unk').length,
    noqr: rowsAll.filter(r => r.state !== 'movein' && needQR(r.s)).length,
    lost: rowsAll.filter(r => r.state === 'lost').length,
    dup: rowsAll.filter(r => dupOf(r.code)).length
  };
  const here = r => r.s && (all || String(r.s.area) === ccCode);
  const people = [...new Set(rowsAll.filter(r => r.s).map(r => r.s.by))].sort();
  let rows = rowsAll.filter(r =>
    tab === 'all'
      ? true
      : tab === 'move'
        ? r.state === 'moveout' || r.state === 'movein'
        : tab === 'borrow'
          ? r.state === 'lentout' || r.state === 'borrowin'
          : tab === 'dup'
            ? !!dupOf(r.code)
            : tab === 'noqr'
              ? r.state !== 'movein' && needQR(r.s)
              : r.state === tab
  );
  if (F.src) rows = rows.filter(r => here(r) && (F.src === 'scan' ? r.s.src !== 'web' : r.s.src === F.src));
  if (F.by) rows = rows.filter(r => r.s && r.s.by === F.by);
  if (F.cond) rows = rows.filter(r => r.s && r.s.cond === F.cond);
  if (F.qr) rows = rows.filter(r => r.s && r.a && (F.qr === 'done' ? !needQR(r.s) : needQR(r.s)));
  if (F.src || F.by) rows.sort((x, y) => y.s.t - x.s.t);
  else rows.sort((x, y) => x.code.localeCompare(y.code));
  if (q) rows = rows.filter(r => norm(r.code).includes(q) || norm(r.a?.name || r.s?.uname || '').includes(q));
  const totalOwn = rowsAll.filter(r => r.state !== 'movein' && r.state !== 'borrowin' && r.state !== 'unk').length,
    doneOwn = rowsAll.filter(r => r.state === 'done' || r.state === 'moveout' || r.state === 'lentout').length;
  if (S.ccPick && !rowsAll.some(r => r.code === S.ccPick)) S.ccPick = null;
  const title = all
    ? 'ทุก Cost Center'
    : `CC ${esc(ccCode)}${area && area.name !== ccCode ? ' · ' + esc(area.name) : ''}`;
  let h = `<main class="wrap"><div><button class="btn sm" data-a="web" data-v="live">← กลับหน้ารวม</button></div>
    <div class="row" style="justify-content:space-between;align-items:flex-end"><div><p class="sub">${esc(meta.name)} · 2 · รายการตรวจนับ</p><h1>${title}</h1></div>
    <div class="chips"><span class="chip c-gray">ทั้งหมด ${N(totalOwn)}</span><span class="chip c-ok">ตรวจแล้ว ${N(doneOwn)}</span><span class="chip c-warn">เหลือ ${N(totalOwn - doneOwn)}</span>${n.move ? `<span class="chip c-oth">ต้องย้าย CC ${n.move}</span>` : ''}${n.unk ? `<span class="chip c-bad">ไม่อยู่ในทะเบียน ${n.unk}</span>` : ''}</div></div>
    ${!all && ccClosed(ccCode) ? `<div class="msg ok row" style="align-items:center;justify-content:space-between"><span><b>✓ ผู้ตรวจนับปิดงาน CC นี้แล้ว</b> · ${closeTxt(ccClosed(ccCode))}</span>${isLead() ? `<button class="btn sm" data-a="ccreopen" data-v="${esc(ccCode)}">เปิดให้นับต่อ</button>` : ''}</div>` : ''}
    ${!all && ccNameDiff(ccCode) ? `<div class="msg warn">⚠ ชื่อแผนกของ CC ${esc(ccCode)} ในไฟล์ไม่ตรงกัน: ${ccNameDiff(ccCode).map(esc).join(' / ')} · ระบบยึดรหัส CC เป็นหลัก ไม่นับว่าต้องย้าย</div>` : ''}
    <div class="bar" aria-label="ความคืบหน้า"><i style="width:${totalOwn ? (doneOwn / totalOwn) * 100 : 0}%;background:var(--ok)"></i></div>
    <div class="row" style="justify-content:space-between;align-items:center"><div class="pills">${CC_TABS.map(([k, l]) => `<button class="pill ${tab === k ? 'on' : ''}" data-a="cctab" data-v="${k}">${l} [${n[k]}]</button>`).join('')}</div>
    <input class="in" id="ccItemQ" value="${esc(S.ccItemQ || '')}" placeholder="ค้นหาเลข Asset หรือชื่อ" style="max-width:260px" aria-label="ค้นหาในรายการ"></div>
    ${tab === 'move' ? `<div class="row" style="justify-content:flex-end">${bulkMoveBox(all ? '' : ccCode, 'cc')}</div>` : ''}
    ${tab === 'noqr' && isLead() ? `<div class="row" style="justify-content:flex-end">${bulkQRBox(rows.filter(r => needQR(r.s)).map(r => r.code))}</div>` : ''}
    <div class="fbar"><span class="sub">ตัวกรอง</span>
      <select class="in" data-ccf="src" aria-label="ที่มา">${SRC_OPTS.map(([k, l]) => `<option value="${k}" ${(F.src || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="in" data-ccf="by" aria-label="ผู้นับ"><option value="">ผู้นับ: ทุกคน</option>${people.map(p => `<option ${F.by === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <select class="in" data-ccf="cond" aria-label="สภาพ"><option value="">สภาพ: ทั้งหมด</option>${['ปกติ', 'ชำรุด', 'รอซ่อม', 'ไม่ใช้งาน'].map(c => `<option ${F.cond === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <select class="in" data-ccf="qr" aria-label="QR"><option value="">QR: ทั้งหมด</option><option value="done" ${F.qr === 'done' ? 'selected' : ''}>QR ครบแล้ว</option><option value="need" ${F.qr === 'need' ? 'selected' : ''}>ยังไม่มี QR</option></select>
      ${Object.values(F).some(Boolean) ? '<button class="btn sm" data-a="ccfclear">ล้างตัวกรอง</button>' : ''}<span class="sub">แสดง ${N(rows.length)} รายการ</span></div>
    <div class="row pair"><section class="card grow" style="min-width:0"><div class="tbl-wrap"><table class="tfix" style="min-width:${all ? 980 : 760}px"><colgroup><col style="width:96px"><col style="width:auto">${all ? '<col style="width:76px"><col style="width:110px">' : ''}<col style="width:164px"><col style="width:160px"><col style="width:124px"><col style="width:114px"></colgroup><thead><tr><th>Asset</th><th>ชื่อ</th>${all ? '<th>CC</th><th>พบที่</th>' : ''}<th>สถานะ</th><th>ที่มา / QR</th><th>ผู้นับ</th><th></th></tr></thead><tbody>`;
  const ST = {
    lost: '<span class="chip c-bad">สูญหาย</span>',
    left: '<span class="chip c-warn">รอตรวจ</span>',
    done: '<span class="chip c-ok">ตรวจแล้ว</span>',
    unk: '<span class="chip c-bad">ไม่อยู่ในทะเบียน</span>'
  };
  for (const r of rows.slice(0, 500)) {
    const s2 = r.s,
      mvTxt =
        r.state === 'moveout'
          ? `<span class="chip c-oth">ต้องย้ายไป ${esc(s2.areaName)}</span>`
          : r.state === 'movein'
            ? `<span class="chip c-oth">ย้ายมาจาก ${esc(r.a.cc)}</span>`
            : r.state === 'lentout'
              ? `<span class="chip c-gray">ให้ ${esc(s2.areaName)} ยืม</span>`
              : r.state === 'borrowin'
                ? `<span class="chip c-gray">ยืมมาจาก ${esc(r.a.cc)}</span>`
                : ST[r.state];
    const decided =
      s2 && s2.rv.move && !isBorrowed(s2)
        ? s2.rv.move === 'approved'
          ? ' <span class="chip c-blue">อนุมัติแล้ว</span>'
          : ' <span class="chip c-gray">ไม่ย้าย</span>'
        : '';
    h += `<tr class="click ${S.ccPick === r.code ? 'sel' : ''}" data-a="ccpick" data-v="${esc(r.code)}"><td class="mono"><b>${esc(r.code)}</b></td><td title="${esc(r.a?.name || s2?.uname || '')}">${esc(r.a?.name || s2?.uname || '(ไม่มีชื่อ)')}${r.a?.raws.length > 1 ? ` <span class="sub">· ${r.a.raws.length} แถว</span>` : ''}</td>${all ? `<td class="mono">${esc(r.a?.cc || '—')}</td><td>${s2 ? esc(s2.areaName) : '<span class="sub">—</span>'}</td>` : ''}<td title="${s2 && s2.cond !== 'ปกติ' ? esc(s2.cond) : ''}">${mvTxt}${decided}${s2 && s2.cond !== 'ปกติ' ? ` <span class="chip c-warn">${esc(s2.cond)}</span>` : ''}${dupOf(r.code) ? ' <span class="chip c-warn" title="สแกนจาก 2 เครื่องตอนออฟไลน์">สแกนซ้ำ</span>' : ''}</td><td>${s2 ? `<span class="chip ${SRC[s2.src][1]}" title="${SRC[s2.src][0]}">${{ qr: 'QR', barcode: 'บาร์โค้ด', manual: 'พิมพ์เอง', web: 'เว็บ' }[s2.src]}</span> ` : ''}${!s2 || !r.a ? '' : hasQR(s2) ? '<span class="chip c-ok">✓ มี QR</span>' : s2.printedAt ? '<span class="chip c-ok">✓ ติดแล้ว</span>' : '<span class="chip c-blue" title="ยังไม่มีสติกเกอร์ QR · อยู่ในคิวพิมพ์">ไม่มี QR</span>'}${s2 && s2.flags.reprint ? ' <span class="chip c-warn">ขอพิมพ์</span>' : ''}</td><td class="sub" title="${s2 ? esc(s2.by) + ' · ' + fmtT(s2.t) : ''}">${s2 ? esc(s2.by) + ' · ' + hm(s2.t) : ''}</td><td style="overflow:visible">${!s2 ? '' : S.confirmUndo === r.code ? `<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm red" data-a="wundo" data-v="${esc(r.code)}" style="min-height:28px;padding:2px 8px;font-size:12px">ยืนยัน</button><button class="btn sm" data-a="noundo" style="min-height:28px;padding:2px 8px;font-size:12px">ไม่</button></span>` : `<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-a="editpop" data-v="${esc(r.code)}" style="min-height:28px;padding:2px 8px;font-size:12px">แก้ไข</button><button class="btn sm red" data-a="askundo" data-v="${esc(r.code)}" style="min-height:28px;padding:2px 8px;font-size:12px" title="ยกเลิกตรวจนับ">ยกเลิก</button></span>`}</td></tr>`;
  }
  h += `</tbody></table></div>${rows.length > 500 ? `<p class="sub">แสดง 500 จาก ${N(rows.length)} รายการ · ค้นหาเพื่อกรอง</p>` : ''}${rows.length ? '' : '<p class="sub">ไม่มีรายการ</p>'}</section>
    <aside class="card side compact" style="flex:0 0 300px">${S.ccPick ? `<div class="sticker"><canvas id="ccSticker" width="560" height="296" aria-label="สติกเกอร์ ${esc(S.ccPick)}"></canvas></div>` + ccDetail(S.ccPick, ccCode) : '<div class="sticker" style="opacity:.35"><canvas id="ccSticker" width="560" height="296" aria-hidden="true"></canvas></div><p class="sub" style="text-align:center">แตะรายการทางซ้ายเพื่อดูสติกเกอร์ รายละเอียด และแก้ไข</p>'}</aside></div></main>`;
  return h;
}
function ccDetail(code, ccCode) {
  const { cur } = compute(),
    s2 = cur.get(code),
    a = master.get(code);
  if (s2) {
    let h = inboxDetail(code);
    h += `<div class="card" style="background:#f8f9fc;padding:12px;gap:8px"><b>แก้ไขผลนับ</b><span class="sub">สภาพ</span><div class="chips">${['ปกติ', 'ชำรุด', 'รอซ่อม', 'ไม่ใช้งาน'].map(x => `<button class="tog" aria-pressed="${s2.cond === x}" data-a="wcond" data-c="${x}" data-v="${esc(code)}">${x}</button>`).join('')}</div>
      <div class="row"><input class="in" id="wRemark" value="${esc(s2.remark)}" placeholder="Remark" style="flex:1"><button class="btn sm" data-a="wremark" data-v="${esc(code)}">บันทึก</button></div>
      ${S.confirmUndo === code ? `<div class="confirm"><b>ยกเลิกผลนับ ${esc(code)}?</b><span>รายการจะกลับไปเป็น "รอตรวจ"</span><div class="row"><button class="btn red" data-a="wundo" data-v="${esc(code)}">ยกเลิกผลนับ</button><button class="btn" data-a="noundo">ไม่ใช่</button></div></div>` : `<button class="btn sm red" data-a="askundo" data-v="${esc(code)}" style="align-self:flex-start">ยกเลิกผลนับ</button>`}</div>`;
    return h;
  }
  if (!a) return '<p class="sub">ไม่พบรายการ</p>';
  const target = ccCode !== '*' ? ccCode : String(a.cc),
    tArea = (meta.areas || []).find(x => String(x.code) === target);
  return `<div class="row" style="justify-content:space-between"><b class="mono" style="font-size:22px">${esc(code)}</b><span class="chip c-warn">รอตรวจ</span></div><div style="font-size:17px">${esc(a.name)}</div>
    <p class="sub">ในทะเบียน: CC ${esc(a.cc)}${a.ccName !== String(a.cc) ? ' · ' + esc(a.ccName) : ''} · Class ${esc(a.cls)}${a.raws.length > 1 ? ` · ${a.raws.length} แถว` : ''}${capDate(a) ? ' · ' + esc(capDate(a)) : ''}</p>
    ${markChoices(code, 'wmark', `data-cc="${esc(target)}" data-ccn="${esc(tArea?.name || target)}"`)}<span class="sub">บันทึกที่ CC ${esc(target)}${tArea && tArea.name !== target ? ' · ' + esc(tArea.name) : ''}</span>`;
}
function badge(s) {
  if (!master.has(s.code)) return '<span class="chip c-bad">ไม่อยู่ในทะเบียน</span>';
  if (isOther(s))
    return s.dec === 'borrowed' || s.rv.move === 'keep'
      ? '<span class="chip c-gray">ยืมมา</span>'
      : `<span class="chip c-oth">${s.rv.move === 'approved' ? 'อนุมัติย้าย' : 'ของแผนกอื่น'}</span>`;
  if (s.cond !== 'ปกติ') return `<span class="chip c-warn">${esc(s.cond)}</span>`;
  return '<span class="chip c-ok">พบ</span>';
}
