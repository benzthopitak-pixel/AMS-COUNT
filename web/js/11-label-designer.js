/* AssetSync · เมนู 5 หน้าออกแบบป้าย: ลากย้าย/ปรับขนาดชิ้นงาน, เลือกคอลัมน์ข้อมูล, บันทึกแม่แบบ */
const lblDraft = () => {
  if (!S.lblEdit || (S.lblEdit.id !== lblActive().id && !S.lblDirty)) S.lblEdit = clone(lblActive());
  return S.lblEdit;
};
const lblZoom = t => Math.max(4, Math.min(16, 720 / t.w, 380 / t.h));
const lblEl = () => S.lblEdit?.els.find(e => e.id === S.lblSelEl) || null;
function webLabelDesign() {
  const t = lblDraft(),
    z = lblZoom(t),
    e = lblEl(),
    F = lblFieldNames();
  const num = (k, l, v, step = 0.5, extra = '') =>
    `<label class="f" style="flex:1">${l}<input class="in" type="number" step="${step}" data-lp="${k}" value="${+(+v).toFixed(2)}" ${extra}></label>`;
  const fieldSel = target =>
    `<select class="in" data-lfield="${target}" aria-label="แทรกช่องข้อมูล"><option value="">＋ แทรกช่องข้อมูล…</option>${F.map(f => `<option value="${esc(f)}">{${esc(f)}}</option>`).join('')}</select>`;
  let h = `<main class="wrap"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><p class="sub">ลากเพื่อย้าย · ลากมุมขวาล่างเพื่อปรับขนาด · ลูกศรเลื่อนทีละ 0.5 มม. (Shift = 2 มม.) · Delete ลบ</p><h1>5 · ออกแบบป้าย</h1></div>
    <button class="btn" data-a="lblmode" data-v="print">← กลับหน้าพิมพ์</button></div>
    <div class="row" style="align-items:flex-end;gap:8px;flex-wrap:wrap"><div style="min-width:260px">${tplPick()}</div>
      <button class="btn" data-a="lblnew">＋ แม่แบบใหม่</button><button class="btn" data-a="lbldup">⧉ ทำสำเนา</button>
      ${t.builtin ? '' : S.lblConfirmDel ? `<span class="confirm" style="padding:6px 10px"><b>ลบแม่แบบนี้?</b> <button class="btn sm red" data-a="lbldel">ลบ</button> <button class="btn sm" data-a="lblnodel">ไม่</button></span>` : '<button class="btn red" data-a="lblaskdel">ลบ</button>'}
      <button class="btn" data-a="lblexp">⬇ ส่งออกแม่แบบ</button><label class="btn">⬆ นำเข้าแม่แบบ<input type="file" id="lblImp" accept=".json,application/json" hidden></label>
      <span style="flex:1"></span>${S.lblDirty ? '<span class="chip c-warn">ยังไม่ได้บันทึก</span><button class="btn" data-a="lblrevert">ยกเลิกการแก้ไข</button>' : ''}<button class="btn pri" data-a="lblsave" ${S.lblDirty ? '' : 'disabled'}>${t.builtin ? 'บันทึกเป็นแม่แบบใหม่' : 'บันทึก'}</button></div>
    ${t.builtin ? '<div class="msg">แม่แบบมาตรฐานแก้ทับไม่ได้ · แก้แล้วกด "บันทึกเป็นแม่แบบใหม่"</div>' : ''}
    <div class="row" style="align-items:flex-start"><section class="card grow" style="min-width:0;gap:12px">
      <div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(LBL_TYPES)
        .map(([k, l]) => `<button class="btn sm" data-a="lbladd" data-v="${k}">＋ ${l}</button>`)
        .join('')}</div>
      <div class="lbl-wrap"><div class="lbl-stage" id="lblStage" style="width:${t.w * z}px;height:${t.h * z}px"><canvas id="lblCv" style="width:${t.w * z}px;height:${t.h * z}px"></canvas>
        ${t.els.map(x => `<div class="lbl-el ${x.id === S.lblSelEl ? 'on' : ''}" data-el="${esc(x.id)}" title="${esc(LBL_TYPES[x.t])}" style="left:${x.x * z}px;top:${x.y * z}px;width:${x.w * z}px;height:${x.h * z}px"><i class="lbl-rs" data-rs="${esc(x.id)}"></i></div>`).join('')}</div></div>
      <span class="sub">ตัวอย่างข้อมูล: ${S.stTab === 'xls' && S.xls ? 'แถวแรกที่เลือกในไฟล์ Excel' : 'รายการแรกที่เลือกในหน้าพิมพ์'} · ${t.w} × ${t.h} มม. · ${t.els.length} ชิ้น</span>
    </section><aside class="card side" style="gap:10px"><b>ป้าย</b>
      <label class="f">ชื่อแม่แบบ<input class="in" data-lt="name" value="${esc(t.name)}"></label>
      <span class="sub">ขนาด 1 ดวง (กรอกเองได้ทุกขนาด)</span>
      <div class="row" style="gap:8px;align-items:flex-end"><label class="f" style="flex:1">กว้าง (มม.)<input class="in" type="number" step="0.5" min="5" max="200" data-lt="w" value="${t.w}"></label><span style="padding-bottom:12px">×</span><label class="f" style="flex:1">สูง (มม.)<input class="in" type="number" step="0.5" min="5" max="200" data-lt="h" value="${t.h}"></label></div>
      <label class="f">หรือเลือกขนาดที่ใช้บ่อย<select class="in" id="lblPreset"><option value="">— เลือก —</option>${LBL_SIZES.map(([w, h]) => `<option value="${w}x${h}" ${t.w === w && t.h === h ? 'selected' : ''}>${w} × ${h} มม.</option>`).join('')}</select></label>
      <div class="row" style="gap:8px"><label class="f" style="flex:1">ดวงต่อแถว (ม้วน)<input class="in" type="number" data-prn="across" min="1" max="6" step="1" value="${prn().across}"></label><label class="f" style="flex:1">ช่องว่างระหว่างดวง (มม.)<input class="in" type="number" data-prn="gap" min="0" max="20" step="0.5" value="${prn().gap}"></label></div>
      <details ${t.pre && (t.pre.top || t.pre.bottom || t.pre.left || t.pre.right) ? 'open' : ''}><summary style="cursor:pointer"><b>ส่วนที่พิมพ์มาแล้วบนกระดาษ</b> <span class="sub">เช่น แถบสีหัวสติกเกอร์</span></summary>
        <div class="row" style="gap:8px;margin-top:6px">${['top', 'bottom', 'left', 'right'].map(k => `<label class="f" style="flex:1">${{ top: 'บน', bottom: 'ล่าง', left: 'ซ้าย', right: 'ขวา' }[k]} (มม.)<input class="in" type="number" min="0" max="100" step="0.5" data-lpre2="${k}" value="${t.pre?.[k] || 0}"></label>`).join('')}</div>
        <label class="f">สีแถบ (แสดงบนจอเท่านั้น ไม่พิมพ์)<input class="in" type="color" data-lpre2="color" value="${esc(t.pre?.color || '#1e88e5')}" style="height:40px;padding:4px"></label></details>
      <span class="sub">${prn().across > 1 ? `กระดาษ 1 แถว = ${+(prn().left + prn().across * t.w + (prn().across - 1) * prn().gap).toFixed(2)} × ${t.h} มม. · ` : ''}ดวงต่อแถว/ช่องว่าง ใช้กับเครื่องพิมพ์ในคอมเครื่องนี้</span>`;
  if (!e) h += `<p class="sub">คลิกชิ้นบนป้ายเพื่อแก้ไข หรือกดปุ่ม ＋ ด้านซ้ายเพื่อเพิ่ม</p>`;
  else {
    h += `<hr style="border:0;border-top:1px solid var(--line);width:100%"><div class="row" style="justify-content:space-between;align-items:center"><b>${esc(LBL_TYPES[e.t])}</b><span class="row" style="gap:4px"><button class="btn sm" data-a="lblorder" data-v="up" title="ไว้ด้านหน้า">▲</button><button class="btn sm" data-a="lblorder" data-v="down" title="ไว้ด้านหลัง">▼</button><button class="btn sm" data-a="lblcopy" title="ทำสำเนาชิ้นนี้">⧉</button><button class="btn sm red" data-a="lblrm">ลบ</button></span></div>
      <div class="row" style="gap:8px">${num('x', 'X (มม.)', e.x)}${num('y', 'Y (มม.)', e.y)}</div>
      <div class="row" style="gap:8px">${e.t === 'qr' ? num('w', 'ขนาด QR (มม.)', e.w) : num('w', 'กว้าง (มม.)', e.w) + num('h', 'สูง (มม.)', e.h)}</div>`;
    const pc = lblSplit(e.t === 'text' ? e.text : e.data),
      colSel = (target, none) =>
        `<select class="in" data-lcol="${target}">${pc.adv ? '<option value="" selected>(กำหนดเองหลายช่อง · ดูด้านล่าง)</option>' : ''}<option value="" ${!pc.adv && !pc.col ? 'selected' : ''}>${none}</option>${F.map(f => `<option value="${esc(f)}" ${!pc.adv && lk(pc.col) === lk(f) ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>`;
    if (e.t === 'text')
      h += `<label class="f">ข้อมูลจากคอลัมน์${colSel('text', '— ไม่ใช้ · ข้อความคงที่ —')}</label>
      ${pc.adv ? '' : `<label class="f">${pc.col ? 'ข้อความนำหน้า (ไม่ใส่ก็ได้ เช่น "No. : ")' : 'ข้อความ'}<input class="in" data-lpre="text" value="${esc(pc.pre)}"></label>`}
      <details ${pc.adv ? 'open' : ''}><summary class="sub" style="cursor:pointer">แบบขั้นสูง: หลายคอลัมน์ในข้อความเดียว</summary><label class="f">ข้อความ ใช้ {ชื่อคอลัมน์}<textarea class="in" rows="2" data-lp="text">${esc(e.text)}</textarea></label>${fieldSel('text')}</details>
      <div class="row" style="gap:8px">${num('fs', 'ขนาดตัวอักษร (pt)', e.fs || 8, 0.5, 'min="3" max="72"')}<label class="f" style="flex:1">จัดวาง<select class="in" data-lp="align">${[
        ['left', 'ชิดซ้าย'],
        ['center', 'กึ่งกลาง'],
        ['right', 'ชิดขวา']
      ]
        .map(([k, l]) => `<option value="${k}" ${(e.align || 'left') === k ? 'selected' : ''}>${l}</option>`)
        .join('')}</select></label></div>
      <div class="row" style="gap:14px"><label class="row" style="gap:6px;align-items:center"><input type="checkbox" data-lp="bold" ${e.bold ? 'checked' : ''}> ตัวหนา</label><label class="row" style="gap:6px;align-items:center"><input type="checkbox" data-lp="wrap" ${e.wrap ? 'checked' : ''}> ขึ้นบรรทัดใหม่ได้ (ตามความสูง)</label></div>`;
    if (e.t === 'qr' || e.t === 'bar')
      h += `<label class="f">สร้าง${e.t === 'qr' ? ' QR Code' : 'บาร์โค้ด'}จากคอลัมน์${colSel('data', '— ไม่ใช้ · ข้อความคงที่ —')}</label>
      <details ${pc.adv || (!pc.col && pc.pre) ? 'open' : ''}><summary class="sub" style="cursor:pointer">แบบขั้นสูง: ข้อมูลกำหนดเอง / หลายคอลัมน์</summary><label class="f">ข้อมูล ใช้ {ชื่อคอลัมน์}<input class="in" data-lp="data" value="${esc(e.data)}"></label>${fieldSel('data')}</details>`;
    if (e.t === 'qr')
      h += `<label class="f">ระดับกู้ข้อมูล<select class="in" data-lp="ecc">${[
        ['L', 'L · 7% (QR เล็กสุด)'],
        ['M', 'M · 15% (แนะนำ)'],
        ['Q', 'Q · 25%'],
        ['H', 'H · 30% (ทนรอยขีดข่วน)']
      ]
        .map(([k, l]) => `<option value="${k}" ${(e.ecc || 'M') === k ? 'selected' : ''}>${l}</option>`)
        .join('')}</select></label>`;
    if (e.t === 'bar')
      h += `<div class="row" style="gap:8px"><label class="f" style="flex:1">ชนิด<select class="in" data-lp="fmt">${['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF', 'codabar'].map(k => `<option ${(e.fmt || 'CODE128') === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label><label class="row" style="gap:6px;align-items:center;flex:1"><input type="checkbox" data-lp="txt" ${e.txt ? 'checked' : ''}> แสดงตัวเลขใต้บาร์โค้ด</label></div>`;
    if (e.t === 'box')
      h += `<div class="row" style="gap:8px">${num('lw', 'ความหนาเส้น (มม.)', e.lw || 0.3, 0.1, 'min="0.1"')}</div>`;
  }
  h += `${S.msg.lbl ? `<div class="msg ${S.msg.lbl[1]}">${esc(S.msg.lbl[0])}</div>` : ''}</aside></div></main>`;
  return h;
}
function lblPaint() {
  const cv = $('#lblCv'),
    t = S.lblEdit;
  if (!cv || !t) return;
  const z = lblZoom(t),
    r = Math.min(3, window.devicePixelRatio || 1) * 1.5;
  cv.width = Math.round(t.w * z * r);
  cv.height = Math.round(t.h * z * r);
  lblDraw(cv.getContext('2d'), t, lblSample(), z * r, true);
}
const lblTouch = () => {
  S.lblDirty = true;
};
// "No. : {Asset}" → { pre: 'No. : ', col: 'Asset' } · anything with 2+ columns or text after the column = advanced
const lblSplit = s => {
  s = String(s ?? '');
  const n = (s.match(/\{[^{}]+\}/g) || []).length;
  if (!n) return { pre: s, col: '' };
  const m = s.match(/^([^{}]*)\{([^{}]+)\}$/);
  return m && n === 1 ? { pre: m[1], col: m[2].trim() } : { adv: true, pre: '', col: '' };
};
const snap = v => Math.round(v * 2) / 2;
function lblAdd(type) {
  const t = lblDraft(),
    id = 'e' + Date.now().toString(36),
    F = lblFieldNames();
  const base = {
    text: { t: 'text', w: Math.min(30, t.w - 4), h: 3.6, text: 'ข้อความ', fs: 8, align: 'left' },
    qr: { t: 'qr', w: Math.min(15, t.h - 4), h: Math.min(15, t.h - 4), data: '{Asset}', ecc: 'M' },
    bar: {
      t: 'bar',
      w: Math.min(36, t.w - 4),
      h: Math.min(8, t.h - 4),
      data: '{' + (F[0] || 'Asset') + '}',
      fmt: 'CODE128'
    },
    box: { t: 'box', w: t.w - 2, h: t.h - 2, lw: 0.3 },
    line: { t: 'line', w: Math.min(30, t.w - 4), h: 0.3 }
  }[type];
  const e = {
    id,
    ...base,
    x: type === 'box' ? 1 : snap(Math.max(0, (t.w - base.w) / 2)),
    y: type === 'box' ? 1 : snap(Math.max(0, (t.h - base.h) / 2))
  };
  t.els.push(e);
  S.lblSelEl = id;
  lblTouch();
}
function lblSetProp(k, v, live) {
  const e = lblEl();
  if (!e) return;
  if (['x', 'y', 'w', 'h', 'fs', 'lw'].includes(k)) {
    v = +v;
    if (!isFinite(v)) return;
    if (k !== 'x' && k !== 'y' && v <= 0) return;
  }
  e[k] = v;
  if (e.t === 'qr' && k === 'w') e.h = v;
  lblTouch();
  if (live) {
    lblPaint();
    const o = document.querySelector(`[data-el="${CSS.escape(e.id)}"]`),
      z = lblZoom(S.lblEdit);
    if (o)
      Object.assign(o.style, {
        left: e.x * z + 'px',
        top: e.y * z + 'px',
        width: e.w * z + 'px',
        height: e.h * z + 'px'
      });
  }
}
let lblDrag = null;
document.addEventListener('pointerdown', ev => {
  if (S.web !== 'stickers' || S.stMode !== 'design') return;
  const rs = ev.target.closest('[data-rs]'),
    el = ev.target.closest('[data-el]'),
    stage = ev.target.closest('#lblStage');
  if (!stage) return;
  if (!el) {
    if (S.lblSelEl) {
      S.lblSelEl = null;
      render();
    }
    return;
  }
  ev.preventDefault();
  const e = S.lblEdit.els.find(x => x.id === el.dataset.el);
  if (!e) return;
  const changed = S.lblSelEl !== e.id;
  S.lblSelEl = e.id;
  document.querySelectorAll('.lbl-el.on').forEach(n => n.classList.remove('on'));
  el.classList.add('on');
  lblDrag = {
    e,
    node: el,
    mode: rs ? 'size' : 'move',
    sx: ev.clientX,
    sy: ev.clientY,
    ox: e.x,
    oy: e.y,
    ow: e.w,
    oh: e.h,
    z: lblZoom(S.lblEdit),
    moved: false,
    changed
  };
});
document.addEventListener('pointermove', ev => {
  const d = lblDrag;
  if (!d) return;
  const t = S.lblEdit,
    dx = (ev.clientX - d.sx) / d.z,
    dy = (ev.clientY - d.sy) / d.z;
  if (Math.abs(dx) + Math.abs(dy) > 0.2) d.moved = true;
  if (d.mode === 'move') {
    d.e.x = Math.max(0, Math.min(t.w - d.e.w, snap(d.ox + dx)));
    d.e.y = Math.max(0, Math.min(t.h - d.e.h, snap(d.oy + dy)));
  } else {
    d.e.w = Math.max(0.5, snap(d.ow + dx));
    d.e.h = d.e.t === 'qr' ? d.e.w : Math.max(0.3, snap(d.oh + dy));
  }
  Object.assign(d.node.style, {
    left: d.e.x * d.z + 'px',
    top: d.e.y * d.z + 'px',
    width: d.e.w * d.z + 'px',
    height: d.e.h * d.z + 'px'
  });
  lblPaint();
});
document.addEventListener('pointerup', () => {
  const d = lblDrag;
  if (!d) return;
  lblDrag = null;
  if (d.moved) lblTouch();
  if (d.moved || d.changed) render();
});
document.addEventListener('keydown', ev => {
  if (
    S.web !== 'stickers' ||
    S.stMode !== 'design' ||
    !S.lblSelEl ||
    /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')
  )
    return;
  const e = lblEl();
  if (!e) return;
  const st = ev.shiftKey ? 2 : 0.5;
  const mv = { ArrowLeft: ['x', -st], ArrowRight: ['x', st], ArrowUp: ['y', -st], ArrowDown: ['y', st] }[ev.key];
  if (mv) {
    ev.preventDefault();
    e[mv[0]] = Math.max(0, snap(e[mv[0]] + mv[1]));
    lblTouch();
    render();
  } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
    ev.preventDefault();
    S.lblEdit.els = S.lblEdit.els.filter(x => x !== e);
    S.lblSelEl = null;
    lblTouch();
    render();
  }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (RENDERING) return;
  if (t.dataset.lp && (t.tagName === 'TEXTAREA' || t.type === 'text' || t.type === 'number' || !t.type))
    lblSetProp(t.dataset.lp, t.value, true);
  if (t.dataset.lt === 'name' && S.lblEdit) {
    S.lblEdit.name = t.value;
    lblTouch();
  }
  if (t.dataset.lpre) {
    const e = lblEl();
    if (e) {
      const k = t.dataset.lpre,
        c = lblSplit(e[k]).col;
      lblSetProp(k, t.value + (c ? `{${c}}` : ''), true);
    }
  }
});
document.addEventListener('change', async ev => {
  const t = ev.target;
  if (RENDERING) return;
  if (t.dataset.lp) {
    lblSetProp(t.dataset.lp, t.type === 'checkbox' ? t.checked : t.value, false);
    setTimeout(render);
    return;
  }
  if (t.dataset.lt && S.lblEdit) {
    if (t.dataset.lt === 'name') S.lblEdit.name = t.value.trim() || 'แม่แบบ';
    else {
      const v = +t.value;
      if (v >= 5 && v <= 200) S.lblEdit[t.dataset.lt] = v;
    }
    lblTouch();
    setTimeout(render);
    return;
  }
  if (t.dataset.lpre) {
    setTimeout(render);
    return;
  }
  if (t.dataset.lpre2 && S.lblEdit) {
    const k = t.dataset.lpre2,
      P = { ...(S.lblEdit.pre || {}) };
    P[k] = k === 'color' ? t.value : Math.max(0, +t.value || 0);
    S.lblEdit.pre = P;
    lblTouch();
    setTimeout(render);
    return;
  }
  if (t.dataset.lcol !== undefined) {
    const e = lblEl();
    if (e) {
      const k = t.dataset.lcol,
        c0 = lblSplit(e[k]),
        pre = c0.adv || c0.pre === 'ข้อความ' ? '' : c0.pre;
      e[k] = t.value ? (k === 'data' ? '' : pre) + `{${t.value}}` : c0.adv ? '' : pre;
      lblTouch();
    }
    setTimeout(render);
    return;
  }
  if (t.dataset.lfield !== undefined && t.value) {
    const e = lblEl();
    if (e) {
      e[t.dataset.lfield] = (e[t.dataset.lfield] || '') + `{${t.value}}`;
      lblTouch();
    }
    setTimeout(render);
    return;
  }
  if (t.id === 'lblPick') {
    if (
      S.lblDirty &&
      S.stMode === 'design' &&
      !confirm('ยังไม่ได้บันทึกแม่แบบที่แก้ไว้ · เปลี่ยนแม่แบบและทิ้งการแก้ไข?')
    ) {
      t.value = S.lblEdit.id;
      return;
    }
    S.lblId = t.value;
    LS.set('lblId', t.value);
    S.lblEdit = null;
    S.lblDirty = false;
    S.lblSelEl = null;
    setTimeout(render);
    return;
  }
  if (t.id === 'lblPreset' && t.value && S.lblEdit) {
    const [w, h] = t.value.split('x').map(Number),
      d = S.lblEdit,
      fx = w / d.w,
      fy = h / d.h;
    if (d.els.length)
      for (const e of d.els) {
        e.x = snap(e.x * fx);
        e.y = snap(e.y * fy);
        if (e.t === 'qr') {
          e.w = e.h = snap(Math.min(e.w * fx, e.h * fy));
        } else {
          e.w = snap(e.w * fx);
          e.h = Math.max(0.3, snap(e.h * fy));
        }
      }
    d.w = w;
    d.h = h;
    lblTouch();
    setTimeout(render);
    return;
  }
  if (t.id === 'lblDpi') {
    LS.set('lblDpi', +t.value);
    return;
  }
  if (t.id === 'stCopies') {
    S.stCopies = Math.max(1, Math.min(50, +t.value || 1));
    setTimeout(render);
    return;
  }
  if (t.id === 'xlsFile' && t.files?.[0]) {
    try {
      await readLabelXls(t.files[0]);
      S.msg.st = [`อ่านไฟล์แล้ว ${N(S.xls.recs.length)} แถว`, 'ok'];
    } catch (e) {
      S.msg.st = ['อ่านไฟล์ไม่ได้: ' + e.message, 'bad'];
    }
    render();
    return;
  }
  if (t.id === 'lblImp' && t.files?.[0]) {
    try {
      const j = JSON.parse(await t.files[0].text()),
        list = Array.isArray(j) ? j : j.templates || [j];
      let n = 0;
      for (const x of list) {
        if (!x || !Array.isArray(x.els) || !(+x.w > 0) || !(+x.h > 0)) continue;
        const tp = {
          id: 't' + Date.now().toString(36) + n,
          name: String(x.name || 'แม่แบบนำเข้า'),
          w: +x.w,
          h: +x.h,
          pre: x.pre && typeof x.pre === 'object' ? x.pre : undefined,
          els: x.els
            .filter(e => e && LBL_TYPES[e.t])
            .map((e, i) => ({ ...e, id: 'e' + i + Math.random().toString(36).slice(2, 6) }))
        };
        lblTpls.push(tp);
        S.lblId = tp.id;
        n++;
      }
      if (!n) throw new Error('ไม่ใช่ไฟล์แม่แบบของ AssetSync');
      await lblSaveAll();
      LS.set('lblId', S.lblId);
      S.lblEdit = null;
      S.lblDirty = false;
      S.msg.lbl = [`นำเข้าแม่แบบแล้ว ${n} แบบ`, 'ok'];
    } catch (e) {
      S.msg.lbl = ['นำเข้าไม่ได้: ' + e.message, 'bad'];
    }
    render();
  }
});
async function lblAction(a, v) {
  const t = lblDraft();
  switch (a) {
    case 'lblmode':
      S.stMode = v;
      S.msg.lbl = null;
      if (v === 'design') {
        S.lblEdit = null;
        S.lblDirty = false;
        S.lblSelEl = null;
      }
      break;
    case 'lbladd':
      lblAdd(v);
      break;
    case 'lblrm':
      t.els = t.els.filter(x => x.id !== S.lblSelEl);
      S.lblSelEl = null;
      lblTouch();
      break;
    case 'lblcopy': {
      const e = lblEl();
      if (e) {
        const n = {
          ...clone(e),
          id: 'e' + Date.now().toString(36),
          x: snap(Math.min(t.w - e.w, e.x + 1)),
          y: snap(Math.min(t.h - e.h, e.y + 1))
        };
        t.els.push(n);
        S.lblSelEl = n.id;
        lblTouch();
      }
      break;
    }
    case 'lblorder': {
      const i = t.els.findIndex(x => x.id === S.lblSelEl),
        j = v === 'up' ? i + 1 : i - 1;
      if (i >= 0 && j >= 0 && j < t.els.length) {
        [t.els[i], t.els[j]] = [t.els[j], t.els[i]];
        lblTouch();
      }
      break;
    }
    case 'lblnew':
      S.lblEdit = { id: 't' + Date.now().toString(36), name: 'แม่แบบใหม่', w: t.w, h: t.h, els: [] };
      S.lblSelEl = null;
      lblTouch();
      break;
    case 'lbldup':
      S.lblEdit = { ...clone(t), id: 't' + Date.now().toString(36), name: t.name + ' (สำเนา)', builtin: undefined };
      S.lblSelEl = null;
      lblTouch();
      break;
    case 'lblrevert':
      S.lblEdit = clone(lblActive());
      S.lblDirty = false;
      S.lblSelEl = null;
      break;
    case 'lblaskdel':
      S.lblConfirmDel = true;
      break;
    case 'lblnodel':
      S.lblConfirmDel = false;
      break;
    case 'lbldel':
      lblTpls = lblTpls.filter(x => x.id !== t.id);
      S.lblConfirmDel = false;
      S.lblId = 'std';
      LS.set('lblId', 'std');
      S.lblEdit = null;
      S.lblDirty = false;
      S.lblSelEl = null;
      try {
        await lblSaveAll();
        S.msg.lbl = ['ลบแม่แบบแล้ว', 'ok'];
      } catch (e) {
        S.msg.lbl = ['ลบไม่สำเร็จ: ' + e.message, 'bad'];
      }
      break;
    case 'lblsave': {
      const x = clone(t);
      if (x.builtin) {
        x.id = 't' + Date.now().toString(36);
        x.name = x.name === LBL_STD.name || x.name === LBL_7050.name ? x.name + ' (แก้ไข)' : x.name;
      }
      delete x.builtin;
      const i = lblTpls.findIndex(y => y.id === x.id);
      if (i >= 0) lblTpls[i] = x;
      else lblTpls.push(x);
      S.lblId = x.id;
      LS.set('lblId', x.id);
      S.lblEdit = clone(x);
      S.lblDirty = false;
      try {
        await lblSaveAll();
        S.msg.lbl = [`บันทึกแม่แบบ "${x.name}" แล้ว · ทุกคนในทีมใช้แม่แบบนี้ได้`, 'ok'];
      } catch (e) {
        S.msg.lbl = ['บันทึกขึ้นระบบไม่สำเร็จ (เก็บไว้ในเครื่องนี้แล้ว): ' + e.message, 'warn'];
      }
      break;
    }
    case 'lblexp':
      S.msg.lbl = await save(
        `AssetSync-แม่แบบป้าย-${t.name.replace(/[\\/:*?"<>|]/g, '_')}.json`,
        JSON.stringify({ app: 'AssetSync label', ver: 1, ...clone(t), builtin: undefined }, null, 2),
        'application/json'
      );
      break;
    case 'prnopen':
      S.prnOpen = !S.prnOpen;
      break;
    case 'xlssel': {
      const i = +v;
      S.xlsSel.has(i) ? S.xlsSel.delete(i) : S.xlsSel.add(i);
      break;
    }
    case 'xlsall':
      if (S.xls) S.xlsSel = S.xlsSel.size === S.xls.recs.length ? new Set() : new Set(S.xls.recs.map((_, i) => i));
      break;
    default:
      return false;
  }
  render();
  return true;
}
