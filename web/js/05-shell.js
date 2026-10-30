/* AssetSync · โครงหน้าจอ: render() วาดหน้าใหม่ทั้งหมด, เลือกหน้าเว็บตามเมนู (webView), แถบสถานะ และงานหลังวาดหน้า (afterRender) */
function flash(t) {
  S.toast = t;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => {
    S.toast = null;
    render();
  }, 2600);
  render();
}
function syncInfo() {
  // [css class, words for tooltip, icon, number to show]
  if (usbMode) {
    const n = Math.max(0, mine.length - LS.get('usbOut-' + (meta?.id || ''), 0));
    return n
      ? ['s-wait', `สาย USB · ยังไม่ส่งออก ${n} รายการ`, 'usb', n]
      : ['s-on', 'สาย USB · ส่งออกครบแล้ว', 'usb', 0];
  }
  if (!db) return ['s-off', 'ยังไม่เชื่อมต่อระบบ', 'off', pendingCount() || (mine.length && 0)];
  const p = pendingCount();
  if (!online) return ['s-bad', p ? `ออฟไลน์ · รอส่งข้อมูล ${p} รายการ` : 'ออฟไลน์ · ไม่มีอินเทอร์เน็ต', 'off', p];
  if (p || writing) return ['s-wait', `กำลังส่ง ${p} รายการ`, 'up', p];
  const rj = db.rejected ? mine.filter(e => db.rejected().has(e.id)).length : 0;
  if (rj) return ['s-bad', `ส่งไม่ได้ ${rj} รายการ (ระบบไม่อนุญาต) · ดูที่แท็บ บัญชี → ตรวจว่าส่งครบ`, 'off', rj];
  if (meta?.ver && meta.ver !== LS.get('masterVer', null)) return ['s-wait', 'กำลังโหลดทะเบียนให้ครบ', 'up', 0];
  return ['s-on', 'ซิงก์แล้ว · ข้อมูลถึงระบบครบ', 'ok', 0];
}
const SYNC_ICON = {
  ok: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1 0 9.5H7z"/><path d="m9 13 2 2 4-4"/>',
  up: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1 0 9.5H7z"/><path d="M12 16v-5m-2.5 2.5L12 11l2.5 2.5"/>',
  off: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 9 7.4M13.5 6.6A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1 2 8.6"/><path d="m4 4 16 16"/>',
  usb: '<path d="M12 3v13m0 0-3-3m3 3 3-3M8 7h.01M16 9h.01M8 7v3l4 2 4-2V9"/><circle cx="12" cy="19" r="2"/>'
};
function syncHtml() {
  const [c, t, ic, n] = syncInfo();
  return `<span id="sync" class="sync ${c}" title="${esc(t)}" role="status" aria-label="${esc(t)}" data-a="syncinfo"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SYNC_ICON[ic]}</svg>${n ? `<b>${N(n)}</b>` : ''}</span>`;
}
function paintSync() {
  const el = $('#sync');
  if (el) el.outerHTML = syncHtml();
}
const stageOf = () => (!meta ? 0 : meta.status === 'closed' ? 4 : 2);

function render() {
  const root = $('#app');
  if (!root) return;
  const keepFocus = document.activeElement?.id,
    keepVal = keepFocus && 'value' in document.activeElement ? document.activeElement.value : null,
    scanVal = $('#scanIn')?.value || '';
  const c = meta && master.size ? cats() : null;
  const inboxN = c ? c.move.length + c.unk.length + c.dmg.length : 0;
  if (S.gate) {
    RENDERING = true;
    try {
      root.innerHTML = gateView();
    } finally {
      RENDERING = false;
    }
    afterRender();
    if (keepFocus && $('#' + keepFocus)) $('#' + keepFocus).focus({ preventScroll: true });
    return;
  }
  let html = '';
  if (S.mode === 'web') {
    // computer: menu runs down the left side
    const stg = stageOf();
    const I = (v, num, label, n, doneAt, sub) => {
      const on = S.web === v || (v === 'live' && S.web === 'cc');
      return `<button class="nav-item ${sub ? 'nav-sub ' : ''}${on ? 'on' : stg > doneAt ? 'done' : ''}" data-a="web" data-v="${v}" ${on ? 'aria-current="page"' : ''}><span class="nav-num">${num}</span><span class="nav-label">${label}</span>${n ? `<span class="nav-badge">${n}</span>` : ''}</button>`;
    };
    // groups fold away; the one holding the open page stays open
    const G = (num, label, kids, pages) => {
      const here = pages.includes(S.web),
        open = here || (LS.get('navOpen', {})[num] ?? false);
      return `<button class="nav-group" data-a="navgrp" data-v="${num}" aria-expanded="${open}"><span class="nav-num">${num}</span><span class="nav-label">${label}</span><span class="nav-chev" aria-hidden="true">${open ? '▾' : '▸'}</span></button>${open ? kids : ''}`;
    };
    let items;
    if (meta && !isLead()) items = I('live', '2', 'รายการตรวจนับ (ดูได้อย่างเดียว)', 0, 99);
    else
      items =
        I('rounds', '1', 'เพิ่มข้อมูลตรวจนับ', 0, 0) +
        I('live', '2', 'รายการตรวจนับ', inboxN, 99) +
        I('close', '3', 'ปิดงาน', 0, 99) +
        G('4', 'สรุปผล', I('pivot', '4.1', 'Pivot Report', 0, 99, 1) + I('report', '4.2', 'รายงานสรุปผล', 0, 99, 1), [
          'pivot',
          'report'
        ]) +
        I('stickers', '5', 'พิมพ์สติกเกอร์', c ? c.reprint.length + c.namebad.length : 0, 99) +
        G(
          '6',
          'ตั้งค่า',
          I('usb', '6.1', 'เชื่อมต่อแบบออฟไลน์', 0, 99, 1) + (usbMode ? '' : I('team', '6.2', 'User', 0, 99, 1)),
          ['usb', 'team']
        );
    html += `<div class="shell"><aside class="side-nav"><div class="side-top"><span class="logo"><img src="logo-mark.svg" alt="" width="36" height="28">AssetSync ${verTag()}</span>${syncHtml()}</div>
      <nav class="nav-list" aria-label="เมนู">${items}</nav>
      <div class="side-foot">${
        meta
          ? `<span class="sub">งานที่เปิดอยู่</span>${
              jobList().length > 1
                ? `<select class="in" id="jobSel" aria-label="สลับงาน" style="font-weight:600">${jobList()
                    .map(
                      j =>
                        `<option value="${esc(j.id)}" ${j.id === meta.id ? 'selected' : ''}>${esc(j.name)}${j.status === 'closed' ? ' (ปิดแล้ว)' : ''}</option>`
                    )
                    .join('')}</select>`
                : `<b>${esc(meta.name)}</b>`
            }`
          : '<span class="sub">ยังไม่มีงานนับ</span>'
      }${S.user ? `<span class="sub">${esc(S.user.name)} · ${S.user.role === 'lead' ? 'Admin' : 'ผู้ตรวจนับ'}</span>` : ''}<span class="sub">ธีม</span>${themeSwitch()}</div></aside><div class="shell-main">`;
  } else {
    html += `<header class="top"><div class="top-in"><span class="logo"><img src="logo-mark.svg" alt="" width="36" height="28">AssetSync ${verTag()}</span>${syncHtml()}</div></header>`;
  }
  html += S.mode === 'web' ? webView(c) + '</div></div>' : appView(c);
  if (S.editPop && S.mode === 'web') html += editDialog(S.editPop);
  if (S.toast) html += `<div class="toast" role="status">${esc(S.toast)}</div>`;
  // keep every scrolled box where it was (a tap inside the right panel must not jump it back to the top)
  const KS = ['.pair > *', '.tbl-wrap', '.sheet', '.side-nav', '.pbody'],
    kept = KS.map(q => [...root.querySelectorAll(q)].map(e => e.scrollTop)),
    winY = window.scrollY;
  const pvKeep = $('#pivotBox[data-ready]');
  RENDERING = true;
  try {
    root.innerHTML = html;
  } finally {
    RENDERING = false;
  }
  if (pvKeep) {
    const slot = $('#pivotBox');
    if (slot) slot.replaceWith(pvKeep);
  }
  KS.forEach((q, i) => {
    const els = [...root.querySelectorAll(q)];
    if (els.length !== kept[i].length) return;
    els.forEach((e, j) => {
      if (S.resetRight && q === '.pair > *' && e.tagName === 'ASIDE') return;
      if (kept[i][j]) e.scrollTop = kept[i][j];
    });
  });
  S.resetRight = false;
  if (Math.abs(window.scrollY - winY) > 1) window.scrollTo(0, winY);
  afterRender();
  requestAnimationFrame(() => {
    if (Math.abs(window.scrollY - winY) > 1 && !S.scrollTop) window.scrollTo(0, winY);
    S.scrollTop = false;
  });
  if (scanVal && $('#scanIn')) $('#scanIn').value = scanVal;
  if (keepFocus && $('#' + keepFocus)) {
    const el = $('#' + keepFocus);
    if (
      keepVal != null &&
      el.value !== undefined &&
      el.type !== 'file' &&
      el.tagName !== 'SELECT' &&
      el.type !== 'checkbox' &&
      el.type !== 'radio'
    )
      el.value = keepVal;
    el.focus({ preventScroll: true });
    if (el.setSelectionRange && el.value != null)
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch {}
  }
}
function afterRender() {
  if (S.mode === 'web' && S.web === 'pivot') setTimeout(mountPivot, 0);
  const iq = $('#installQr');
  if (iq && typeof qrcode === 'function') {
    const q = qrcode(0, 'M');
    q.addData(new URL('install.html', location.href).href);
    q.make();
    const n = q.getModuleCount(),
      c = iq.getContext('2d'),
      m = Math.floor(iq.width / (n + 4)),
      o = Math.floor((iq.width - n * m) / 2);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, iq.width, iq.height);
    c.fillStyle = '#121826';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(o + k * m, o + r * m, m, m);
  }
  const st = $('#stPrev');
  if (st) {
    const tpl = lblActive();
    st.height = Math.round((st.width * tpl.h) / tpl.w);
    lblDraw(st.getContext('2d'), tpl, lblSample(), st.width / tpl.w, true);
  }
  if ($('#lblCv')) lblPaint();
  const it = $('#itemSticker');
  if (it) drawSticker(it, S.item);
  const cs = $('#ccSticker');
  if (cs) drawSticker(cs, S.ccPick || ccRows(S.ccSel || '*')[0]?.code || '');
  if (
    S.mode === 'app' &&
    S.app === 'scan' &&
    !S.item &&
    !S.areaPick &&
    !S.search &&
    document.activeElement?.id !== 'scanIn'
  )
    $('#scanIn')?.focus({ preventScroll: true });
  if (S.search && !S.item && document.activeElement?.id !== 'srchIn') {
    const si = $('#srchIn');
    if (si) {
      si.focus({ preventScroll: true });
      try {
        si.setSelectionRange(si.value.length, si.value.length);
      } catch {}
    }
  }
}
/* ================= WEB ================= */
function webView(c) {
  if (S.web === 'team' && !usbMode && isLead()) return webTeam();
  if (!isLead())
    return meta && master.size
      ? S.web === 'cc'
        ? webCC()
        : webLive(c)
      : `<main class="wrap"><div class="card"><h2>ยังไม่มีรอบนับที่เปิดอยู่</h2><p class="sub">บัญชีผู้ตรวจนับดูผลบนคอมพิวเตอร์ได้อย่างเดียว · งานเตรียม ตรวจ และปิดรอบเป็นของ Admin</p></div></main>`;
  if (!meta || S.web === 'rounds') return webRounds(c);
  if (S.web === 'live') return webLive(c);
  if (S.web === 'cc') return webCC();
  if (S.web === 'inbox') return webLive(c);
  if (S.web === 'report' || S.web === 'pivot') return webReport();
  if (S.web === 'close') return webClose(c);
  if (S.web === 'export') {
    S.web = 'report';
    S.repTab = 'files';
    return webReport();
  }
  if (S.web === 'stickers') return webStickers(c);
  if (S.web === 'usb') return webUsb();
  return webRounds(c);
}
