/* AssetSync · เมนู 5 พิมพ์สติกเกอร์: แหล่งรายการ, แม่แบบป้าย, หน้าพิมพ์ และวาดป้ายสำหรับพิมพ์/PDF */
function stickerList(c) {
  const { cur } = compute();
  if (S.stTab === 'reprint') return c.reprint.map(s => s.code);
  if (S.stTab === 'namebad') return c.namebad.map(s => s.code);
  if (S.stTab === 'moved') return [...cur.values()].filter(s => s.rv.move === 'approved').map(s => s.code);
  if (S.stTab === 'ns') return [...cur.values()].filter(s => s.ns).map(s => s.code);
  if (S.stTab === 'noqr') return [...cur.values()].filter(needQR).map(s => s.code);
  if (S.stTab === 'oldqr') return [...cur.values()].filter(oldQR).map(s => s.code);
  if (S.stTab === 'paste') {
    const out = [];
    for (const t of S.stPaste.split(/[\s,;]+/)) {
      const r = lookup(t);
      for (const c2 of r.multi || [r.code]) if (c2 && master.has(c2) && !out.includes(c2)) out.push(c2);
    }
    return out;
  } // Asset only → every Sub
  return [];
}

/* ---------- label templates: size, layout and data all editable (menu 5 → ออกแบบป้าย) ----------
 * template = { id, name, w, h (mm), els: [{ id, t: text | qr | bar | box | line, x, y, w, h (mm), ... }] }
 * text / data use {ชื่อคอลัมน์} placeholders: any column of the imported file, the count results, or the columns of an Excel file */
const PT = 0.3528; // 1 pt in mm
if (typeof qrcode === 'function') qrcode.stringToBytes = s => Array.from(new TextEncoder().encode(String(s))); // Thai text in a QR
const LBL_STD = {
  id: 'std',
  name: 'ป้ายมาตรฐาน (แบบเดิม)',
  w: 50,
  h: 25,
  builtin: true,
  els: [
    { id: 'a1', t: 'text', x: 2.2, y: 2.2, w: 26.8, h: 3.4, text: 'No. : {Asset-Sub}', fs: 7.4, align: 'left' },
    { id: 'a2', t: 'text', x: 2.2, y: 6.0, w: 26.8, h: 3.4, text: 'Date : {วันที่ซื้อ}', fs: 7.4, align: 'left' },
    { id: 'a3', t: 'text', x: 2.2, y: 9.8, w: 26.8, h: 3.4, text: 'CC : {CC บนป้าย}', fs: 7.4, align: 'left' },
    { id: 'a4', t: 'text', x: 2.2, y: 13.6, w: 26.8, h: 3.4, text: 'HO: {ชื่อ CC บนป้าย}', fs: 7.4, align: 'left' },
    { id: 'a5', t: 'text', x: 2.2, y: 17.4, w: 26.8, h: 3.4, text: '{ชื่อ}', fs: 7.4, align: 'left' },
    { id: 'q1', t: 'qr', x: 31.2, y: 4.2, w: 16.5, h: 16.5, data: '{Asset-Sub}' }
  ]
};
// thermal roll 70 × 50 mm with a 10 mm pre-printed header band: everything sits in the 40 mm below it
const LBL_7050 = {
  id: 'std7050',
  name: 'ป้าย 70 × 50 (หัวแถบสี 10 มม.)',
  w: 70,
  h: 50,
  builtin: true,
  pre: { top: 10, color: '#1e88e5' },
  els: [
    { id: 'b0', t: 'qr', x: 3, y: 14, w: 32, h: 32, data: '{Asset-Sub}', ecc: 'M' },
    { id: 'b1', t: 'text', x: 37, y: 14, w: 31, h: 5, text: '{Asset-Sub}', fs: 12, bold: true, align: 'left' },
    { id: 'b2', t: 'text', x: 37, y: 20.5, w: 31, h: 10, text: '{ชื่อ}', fs: 8, align: 'left', wrap: true },
    { id: 'b3', t: 'text', x: 37, y: 31.5, w: 31, h: 3.6, text: 'CC : {CC บนป้าย}', fs: 7.5, align: 'left' },
    { id: 'b4', t: 'text', x: 37, y: 35.5, w: 31, h: 3.6, text: 'HO: {ชื่อ CC บนป้าย}', fs: 7.5, align: 'left' },
    { id: 'b5', t: 'text', x: 37, y: 39.5, w: 31, h: 3.6, text: 'Date : {วันที่ซื้อ}', fs: 7.5, align: 'left' }
  ]
};
const LBL_SIZES = [
  [50, 25],
  [50, 30],
  [50, 40],
  [40, 30],
  [60, 40],
  [70, 40],
  [70, 50],
  [80, 50],
  [100, 50],
  [100, 75],
  [100, 100],
  [100, 150],
  [32, 25],
  [30, 20],
  [25, 15]
]; // common thermal rolls in Thailand
const LBL_TYPES = { text: 'ข้อความ', qr: 'QR Code', bar: 'บาร์โค้ด', box: 'กรอบ', line: 'เส้น / แถบทึบ' };
const clone = o => JSON.parse(JSON.stringify(o));
const lk = k =>
  String(k ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
let lblTpls = LS.get('lblTpls', []);
const lblAll = () => [LBL_STD, LBL_7050, ...lblTpls];
const lblActive = () => lblAll().find(t => t.id === S.lblId) || LBL_STD;
const lblDpi = () => +LS.get('lblDpi', 300) || 300;
async function lblLoad() {
  if (!db) return;
  try {
    const d = await db.doc('labels').get();
    if (d.exists) {
      lblTpls = (d.data().list || []).filter(t => t && t.id && t.els);
      LS.set('lblTpls', lblTpls);
      render();
    }
  } catch {}
}
async function lblSaveAll() {
  LS.set('lblTpls', lblTpls);
  if (db) await db.doc('labels').set({ list: lblTpls, at: Date.now() });
}
const lblFill = (s, rec) =>
  String(s ?? '').replace(/\{([^{}]+)\}/g, (_, k) => {
    const v = rec[lk(k)];
    return v == null ? '' : String(v);
  });

// one record per sticker: every column of the imported file + names for the label + count results
function lblRecord(code) {
  const a = master.get(code),
    s2 = compute().cur.get(code),
    cc = labelCC(code),
    r = {};
  const put = (k, v) => {
    if (String(k).trim()) r[lk(k)] = v ?? '';
  };
  (meta?.headers || []).forEach((h, i) => {
    let v = a?.raws[0]?.[i];
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''))) v = dmy(v);
    put(h, v);
  });
  put('Asset', a?.asset || code);
  put('Sub', a?.sub ?? '');
  put('Asset-Sub', a ? fullCode(a) : code);
  put('ชื่อ', a?.name || s2?.uname || '');
  put('CC บนป้าย', cc.code);
  put('ชื่อ CC บนป้าย', cc.name);
  put('วันที่ซื้อ', a ? capDate(a) : '');
  if (a) for (const [k, l] of RES_F) put(l, crVal(k, a, s2));
  put('วันที่พิมพ์', new Date().toLocaleDateString('th-TH'));
  return r;
}
function lblFieldNames() {
  const out =
    S.stTab === 'xls' && S.xls
      ? [...S.xls.headers]
      : [
          'Asset-Sub',
          'Asset',
          'Sub',
          'ชื่อ',
          'CC บนป้าย',
          'ชื่อ CC บนป้าย',
          'วันที่ซื้อ',
          ...(meta?.headers || []).map(h => String(h).trim()),
          ...RES_F.map(x => x[1])
        ];
  out.push('วันที่พิมพ์');
  const seen = new Set();
  return out.filter(x => x && !seen.has(lk(x)) && seen.add(lk(x)));
}
const lblSample = () =>
  S.stTab === 'xls' && S.xls
    ? S.xls.recs[[...S.xlsSel][0] ?? 0] || {}
    : lblRecord([...S.stSel][0] || stickerList(cats())[0] || [...master.keys()][0] || '51000001');

const graph = s => {
  try {
    return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(s)].map(x => x.segment);
  } catch {
    return Array.from(s);
  }
};
function wrapText(ctx, txt, maxW, maxL) {
  const out = [];
  let line = '';
  for (const raw of String(txt).split('\n')) {
    line = '';
    for (const g of graph(raw)) {
      if (ctx.measureText(line + g).width <= maxW || !line) {
        line += g;
        continue;
      }
      const sp = line.lastIndexOf(' ');
      if (sp > 0) {
        out.push(line.slice(0, sp));
        line = line.slice(sp + 1) + g;
      } else {
        out.push(line);
        line = g;
      }
    }
    out.push(line);
  }
  if (out.length > maxL) {
    out.length = maxL;
    out[maxL - 1] += '…';
  }
  return out.map((l, i) => {
    if (i !== out.length - 1 || ctx.measureText(l).width <= maxW) return l;
    let s = l;
    while (s.length > 1 && ctx.measureText(s).width > maxW) s = s.slice(0, -2) + '…';
    return s;
  });
}
// draw one sticker at k pixels per mm (the printer's dots: 203 dpi = 8, 300 dpi ≈ 11.8)
// guide = true on screen only: shows what is already printed on the paper (e.g. a blue header band) so the layout avoids it · never sent to the printer
function lblDraw(ctx, tpl, rec, k, guide) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const P = tpl.pre;
  if (guide && P) {
    ctx.fillStyle = P.color || '#1e88e5';
    const W = tpl.w * k,
      H = tpl.h * k;
    if (P.top) ctx.fillRect(0, 0, W, P.top * k);
    if (P.bottom) ctx.fillRect(0, H - P.bottom * k, W, P.bottom * k);
    if (P.left) ctx.fillRect(0, 0, P.left * k, H);
    if (P.right) ctx.fillRect(W - P.right * k, 0, P.right * k, H);
  }
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.textBaseline = 'top';
  ctx.imageSmoothingEnabled = false;
  for (const e of tpl.els) {
    const x = e.x * k,
      y = e.y * k,
      w = e.w * k,
      h = e.h * k;
    if (e.t === 'text') {
      const px = (+e.fs || 8) * PT * k;
      ctx.font = `${e.bold ? 700 : 500} ${px}px Prompt, sans-serif`;
      const lh = px * 1.28,
        lines = wrapText(ctx, lblFill(e.text, rec), w, e.wrap ? Math.max(1, Math.floor((h + px * 0.28) / lh)) : 1);
      ctx.textAlign = e.align || 'left';
      const ax = e.align === 'center' ? x + w / 2 : e.align === 'right' ? x + w : x;
      lines.forEach((l, i) => ctx.fillText(l, ax, y + i * lh));
      ctx.textAlign = 'left';
    } else if (e.t === 'qr') {
      const d = lblFill(e.data, rec);
      if (!d || typeof qrcode !== 'function') continue;
      try {
        const q = qrcode(0, e.ecc || 'M');
        q.addData(d);
        q.make();
        const n = q.getModuleCount(),
          s = Math.min(w, h),
          m = Math.max(1, Math.floor(s / n)),
          x0 = Math.round(x + (s - n * m) / 2),
          y0 = Math.round(y + (s - n * m) / 2);
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x0 + c * m, y0 + r * m, m, m);
      } catch {}
    } else if (e.t === 'bar') {
      const d = lblFill(e.data, rec);
      if (!d || !window.JsBarcode) continue;
      try {
        const showTxt = !!e.txt,
          th = showTxt ? Math.min(h * 0.3, 2.6 * k) : 0,
          bh = Math.max(1, Math.round(h - th));
        const c1 = document.createElement('canvas');
        JsBarcode(c1, d, {
          format: e.fmt || 'CODE128',
          width: 1,
          height: 4,
          displayValue: false,
          margin: 0,
          background: '#ffffff'
        });
        const m = Math.max(1, Math.floor(w / c1.width)),
          c2 = document.createElement('canvas');
        JsBarcode(c2, d, {
          format: e.fmt || 'CODE128',
          width: m,
          height: bh,
          displayValue: false,
          margin: 0,
          background: '#ffffff'
        });
        const dw = Math.min(c2.width, w);
        ctx.drawImage(c2, Math.round(x + (w - dw) / 2), Math.round(y), dw, bh);
        if (showTxt) {
          ctx.font = `500 ${th * 0.9}px Prompt, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(d, x + w / 2, y + bh + th * 0.08);
          ctx.textAlign = 'left';
        }
      } catch {
        ctx.font = `500 ${2.4 * k}px Prompt, sans-serif`;
        ctx.fillStyle = '#c00';
        ctx.fillText('บาร์โค้ดไม่รองรับข้อมูลนี้', x, y);
        ctx.fillStyle = '#000';
      }
    } else if (e.t === 'box') {
      const lw = Math.max(1, (+e.lw || 0.3) * k);
      ctx.lineWidth = lw;
      ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
    } else if (e.t === 'line') ctx.fillRect(x, y, Math.max(1, w), Math.max(1, h));
  }
  ctx.restore();
}
// preview canvases elsewhere (CC page, item sheet) follow the active template
function drawSticker(cv, code) {
  if (!cv?.getContext) return;
  const tpl = lblActive();
  cv.height = Math.round((cv.width * tpl.h) / tpl.w);
  lblDraw(cv.getContext('2d'), tpl, lblRecord(code), cv.width / tpl.w, true);
}

/* ---------- 5 · print page ---------- */
const ST_TABS = c => {
  const { cur } = compute();
  return [
    ['reprint', 'ต้องพิมพ์ใหม่', c.reprint.length],
    ['namebad', 'ชื่อไม่ตรงระบบ', c.namebad.length],
    ['moved', 'ย้ายแผนก (อนุมัติแล้ว)', [...cur.values()].filter(s => s.rv.move === 'approved').length],
    ['noqr', 'ยังไม่มี QR', [...cur.values()].filter(needQR).length],
    ['oldqr', 'ป้าย QR รูปแบบเก่า', [...cur.values()].filter(oldQR).length],
    ['ns', 'ยังไม่มีสติกเกอร์', [...cur.values()].filter(s => s.ns).length],
    ['paste', 'วางเลข Asset เอง', ''],
    ['xls', '📄 จากไฟล์ Excel', S.xls ? S.xls.recs.length : '']
  ];
};
const tplPick = () =>
  `<label class="f">แม่แบบป้าย<select class="in" id="lblPick">${lblAll()
    .map(
      t =>
        `<option value="${esc(t.id)}" ${t.id === lblActive().id ? 'selected' : ''}>${esc(t.name)} · ${t.w} × ${t.h} มม.</option>`
    )
    .join('')}</select></label>`;
function webStickers(c) {
  if (!S.lblLoaded) {
    S.lblLoaded = true;
    lblLoad();
  }
  if (S.stMode === 'design') return webLabelDesign();
  const xls = S.stTab === 'xls',
    list = xls ? [] : stickerList(c),
    { cur } = compute(),
    tpl = lblActive();
  if (!xls) for (const x of [...S.stSel]) if (!list.includes(x)) S.stSel.delete(x);
  const nSel = xls ? S.xlsSel.size : S.stSel.size,
    copies = Math.max(1, +S.stCopies || 1),
    dis = nSel ? '' : 'disabled';
  let h = `<main class="wrap"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><p class="sub">ออกแบบป้ายเองได้ · ข้อมูลจากไฟล์ทะเบียน ผลตรวจนับ หรือไฟล์ Excel</p><h1>5 · พิมพ์สติกเกอร์</h1></div>
    <div class="row" style="align-items:center"><span class="sub">เลือกแล้ว <b style="color:var(--blue)">${nSel}</b> รายการ</span><button class="btn" data-a="lblmode" data-v="design">✎ ออกแบบป้าย</button></div></div>
    <div class="pills">${ST_TABS(c)
      .map(
        ([k, l, n]) =>
          `<button class="pill ${S.stTab === k ? 'on' : ''}" data-a="sttab" data-v="${k}">${l}${n !== '' ? ` [${n}]` : ''}</button>`
      )
      .join('')}</div>
    <div class="row"><section class="card grow" style="min-width:0">`;
  if (xls) {
    h += `<div class="row" style="align-items:center"><label class="btn">📄 เลือกไฟล์ Excel<input type="file" id="xlsFile" accept=".xlsx,.xls,.csv" hidden></label><span class="sub">${S.xls ? `${esc(S.xls.name)} · ${N(S.xls.recs.length)} แถว · ${S.xls.headers.length} คอลัมน์ · ใช้ชื่อคอลัมน์ในแม่แบบได้ เช่น {${esc(S.xls.headers[0] || 'Asset')}}` : 'แถวแรกของไฟล์ = ชื่อคอลัมน์ · 1 แถว = 1 ป้าย'}</span></div>`;
    if (S.xls) {
      const H = S.xls.headers.slice(0, 5);
      h += `<div class="tbl-wrap"><table><thead><tr><th><input type="checkbox" data-a="xlsall" aria-label="เลือกทั้งหมด" ${S.xlsSel.size === S.xls.recs.length ? 'checked' : ''}></th>${H.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>`;
      S.xls.rows.slice(0, 300).forEach((r, i) => {
        h += `<tr><td><input type="checkbox" data-a="xlssel" data-v="${i}" ${S.xlsSel.has(i) ? 'checked' : ''} aria-label="เลือกแถว ${i + 1}"></td>${H.map((_, j) => `<td>${esc(r[j] ?? '')}</td>`).join('')}</tr>`;
      });
      h += `</tbody></table></div>${S.xls.rows.length > 300 ? `<p class="sub">แสดง 300 แถวแรก · "เลือกทั้งหมด" รวมทุก ${N(S.xls.rows.length)} แถว</p>` : ''}`;
    }
  } else {
    if (S.stTab === 'paste')
      h += `<label class="f">เลข Asset หรือ Asset-Sub บรรทัดละ 1 รหัส (ใส่เฉพาะเลข Asset = ทุกรายการย่อย)<textarea class="in mono" id="stPaste" rows="4" placeholder="51000136">${esc(S.stPaste)}</textarea></label>`;
    h += `<div class="tbl-wrap"><table><thead><tr><th><input type="checkbox" data-a="stall" aria-label="เลือกทั้งหมด" ${list.length && list.every(x => S.stSel.has(x)) ? 'checked' : ''}></th><th>No.</th><th>ชื่อ</th><th>CC บนป้าย</th><th>พิมพ์ล่าสุด</th></tr></thead><tbody>`;
    for (const code of list.slice(0, 300)) {
      const a = master.get(code),
        s = cur.get(code),
        cc = labelCC(code);
      h += `<tr><td><input type="checkbox" data-a="stsel" data-v="${esc(code)}" ${S.stSel.has(code) ? 'checked' : ''} aria-label="เลือก ${esc(code)}"></td><td class="mono">${esc(code)}</td><td>${esc(a?.name || '')}</td><td>${esc(cc.code)} ${esc(cc.name)}</td><td class="sub">${s?.printedAt ? fmtT(s.printedAt) : '—'}</td></tr>`;
    }
    h += `</tbody></table></div>${list.length ? '' : '<p class="sub">ไม่มีรายการ</p>'}`;
  }
  const a4 = S.stSize === 'a4',
    per = Math.floor(210 / tpl.w) * Math.floor(297 / tpl.h);
  h += `</section><aside class="card side"><b>ตัวอย่างป้าย</b><div class="sticker" style="transform:none"><canvas id="stPrev" width="560" height="280" aria-label="ตัวอย่างสติกเกอร์"></canvas></div>
    ${tplPick()}
    ${(() => {
      const have = new Set(lblFieldNames().map(lk)),
        miss = [
          ...new Set(
            tpl.els.flatMap(e =>
              [
                ...String(e.text || '').matchAll(/\{([^{}]+)\}/g),
                ...String(e.data || '').matchAll(/\{([^{}]+)\}/g)
              ].map(m => m[1].trim())
            )
          )
        ].filter(f => !have.has(lk(f)));
      return miss.length
        ? `<div class="msg warn">แม่แบบนี้ใช้ช่อง ${miss.map(f => '{' + esc(f) + '}').join(' ')} ที่ไม่มีใน${xls ? 'ไฟล์ Excel' : 'ข้อมูล'} · ช่องนี้จะว่าง · แก้ที่ "ออกแบบป้าย"</div>`
        : '';
    })()}
    <label class="f">เครื่องพิมพ์ / กระดาษ<select class="in" id="stSize"><option value="roll" ${a4 ? '' : 'selected'}>เครื่องพิมพ์สติกเกอร์ · ม้วน (${tpl.w} × ${tpl.h} มม.)</option><option value="a4" ${a4 ? 'selected' : ''} ${per ? '' : 'disabled'}>เครื่องพิมพ์ธรรมดา · A4 ${per} ดวงต่อแผ่น</option></select></label>
    ${a4 ? '' : prnBox(tpl)}
    <div class="row" style="gap:8px"><label class="f" style="flex:1">ความละเอียด<select class="in" id="lblDpi">${[203, 300, 600].map(d => `<option value="${d}" ${lblDpi() === d ? 'selected' : ''}>${d} dpi</option>`).join('')}</select></label>
      <label class="f" style="flex:1">จำนวนต่อรายการ<input class="in" id="stCopies" type="number" min="1" max="50" value="${copies}"></label></div>
    ${
      Store.isApp
        ? `<div class="row"><button class="btn" data-a="stpdf" data-v="test" ${dis}>ทดสอบ 1 ดวง</button><button class="btn pri" data-a="stpdf" data-v="all" ${dis}>PDF ${nSel * copies} ดวง</button></div>`
        : `<button class="btn pri" data-a="stprint" data-v="all" ${dis}>🖨 พิมพ์ ${N(nSel * copies)} ดวง</button><div class="row"><button class="btn" data-a="stprint" data-v="test" ${dis}>🖨 ทดสอบ 1 ดวง</button><button class="btn" data-a="stpdf" data-v="all" ${dis}>⬇ PDF</button></div>
    <span class="sub">พิมพ์ตรงจากเว็บ ไม่ต้องใช้ BarTender · หน้าพิมพ์: เลือกเครื่องพิมพ์สติกเกอร์ · ขอบกระดาษ = ไม่มี · สเกล = 100% · ความละเอียดให้ตรงกับเครื่องพิมพ์</span>`
    }
    ${
      xls
        ? ''
        : `<button class="btn" data-a="stxlsx" ${dis}>⬇ Excel ตามแม่แบบ OGA (${S.stSel.size})</button><span class="sub">สำหรับ BarTender · 1 แถวต่อ 1 Sub-number</span>
    <button class="btn lime" data-a="stdone" ${dis}>บันทึกว่าติดแล้ว</button>`
    }${S.msg.st ? `<div class="msg ${S.msg.st[1]}">${esc(S.msg.st[0])}</div>` : ''}</aside></div></main>`;
  return h;
}
// label-printer setup (per computer: it belongs to the printer, not the template)
const PRN0 = { across: 1, gap: 2, left: 0, dx: 0, dy: 0, rot: 0 };
const prn = () => ({ ...PRN0, ...LS.get('prn', {}) });
function prnBox(tpl) {
  const p = prn(),
    o = S.prnOpen,
    n = (k, l, step, min, max) =>
      `<label class="f" style="flex:1">${l}<input class="in" type="number" data-prn="${k}" step="${step}" min="${min}" max="${max}" value="${p[k]}"></label>`;
  const pw = p.rot % 180 ? tpl.h : tpl.w,
    ph = p.rot % 180 ? tpl.w : tpl.h,
    W = +(p.left + p.across * pw + (p.across - 1) * p.gap).toFixed(2);
  return `<div class="card" style="background:#f8f9fc;padding:10px 12px;gap:8px"><button class="row" data-a="prnopen" style="all:unset;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><b>⚙ ตั้งค่าเครื่องพิมพ์สติกเกอร์</b><span class="sub">${p.across} ดวง/แถว${p.rot ? ' · หมุน ' + p.rot + '°' : ''}${p.dx || p.dy ? ' · เลื่อน' : ''} ${o ? '▲' : '▼'}</span></button>
    ${
      o
        ? `<div class="row" style="gap:8px">${n('across', 'ดวงต่อแถว (ม้วนกี่ดวงขวาง)', 1, 1, 6)}${n('gap', 'ช่องว่างระหว่างดวง (มม.)', 0.5, 0, 20)}</div>
    <div class="row" style="gap:8px">${n('left', 'ขอบซ้ายกระดาษรอง (มม.)', 0.5, 0, 30)}<label class="f" style="flex:1">หมุนป้าย<select class="in" data-prn="rot">${[0, 90, 180, 270].map(r => `<option value="${r}" ${p.rot === r ? 'selected' : ''}>${r}°</option>`).join('')}</select></label></div>
    <div class="row" style="gap:8px">${n('dx', 'เลื่อนซ้าย-ขวา (มม.)', 0.5, -20, 20)}${n('dy', 'เลื่อนขึ้น-ลง (มม.)', 0.5, -20, 20)}</div>
    <span class="sub">ในไดรเวอร์เครื่องพิมพ์ตั้งขนาดกระดาษ = <b>${W} × ${+ph.toFixed(2)} มม.</b> · ชนิดกระดาษ = มีช่องว่าง (Gap) หรือรอยดำ (Black mark) ตามม้วนจริง · พิมพ์ทดสอบ 1 ดวง ถ้าตำแหน่งเหลื่อมให้ปรับ "เลื่อน" · ค่านี้จำไว้เฉพาะคอมเครื่องนี้</span>`
        : ''
    }</div>`;
}
document.addEventListener('change', ev => {
  const t = ev.target;
  if (RENDERING || !t.dataset.prn) return;
  const v = +t.value;
  if (!isFinite(v)) return;
  LS.set('prn', {
    ...prn(),
    [t.dataset.prn]: t.dataset.prn === 'across' ? Math.max(1, Math.min(6, Math.round(v))) : v
  });
  setTimeout(render);
});
async function readLabelXls(f) {
  const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false }),
    ws = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils
    .sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false })
    .filter(r => r.some(v => String(v).trim() !== ''));
  if (!all.length) throw new Error('ไฟล์ว่าง');
  const headers = all[0].map((x, i) => String(x).trim() || `คอลัมน์ ${i + 1}`),
    rows = all.slice(1);
  const recs = rows.map(r => {
    const o = {};
    headers.forEach((hd, i) => {
      o[lk(hd)] = r[i] ?? '';
    });
    o[lk('วันที่พิมพ์')] = new Date().toLocaleDateString('th-TH');
    return o;
  });
  S.xls = { name: f.name, headers, rows, recs };
  S.xlsSel = new Set(recs.map((_, i) => i));
}

/* ---------- printing: same drawing for print, PDF and previews ---------- */
function lblRecords(test) {
  const recs =
    S.stTab === 'xls'
      ? S.xls
        ? [...S.xlsSel]
            .sort((a, b) => a - b)
            .map(i => S.xls.recs[i])
            .filter(Boolean)
        : []
      : [...S.stSel].map(lblRecord);
  if (test) return recs.slice(0, 1);
  const n = Math.max(1, Math.min(50, +S.stCopies || 1)),
    out = [];
  for (const r of recs) for (let i = 0; i < n; i++) out.push(r);
  return out.slice(0, 3000);
}
async function lblImages(recs) {
  try {
    await document.fonts?.load('500 20px Prompt');
    await document.fonts?.load('700 20px Prompt');
  } catch {}
  const tpl = lblActive(),
    k = lblDpi() / 25.4,
    cv = document.createElement('canvas');
  cv.width = Math.round(tpl.w * k);
  cv.height = Math.round(tpl.h * k);
  const ctx = cv.getContext('2d'),
    rot = S.stSize === 'a4' ? 0 : prn().rot;
  const rc = document.createElement('canvas');
  rc.width = rot % 180 ? cv.height : cv.width;
  rc.height = rot % 180 ? cv.width : cv.height;
  const rx = rc.getContext('2d');
  return recs.map(r => {
    lblDraw(ctx, tpl, r, k);
    if (!rot) return cv.toDataURL('image/png');
    rx.setTransform(1, 0, 0, 1, 0, 0);
    rx.fillStyle = '#fff';
    rx.fillRect(0, 0, rc.width, rc.height);
    rx.translate(rc.width / 2, rc.height / 2);
    rx.rotate((rot * Math.PI) / 180);
    rx.drawImage(cv, -cv.width / 2, -cv.height / 2);
    return rc.toDataURL('image/png');
  });
}
async function stickerPrint(test) {
  const recs = lblRecords(test);
  if (!recs.length) return ['ยังไม่ได้เลือกรายการ', 'warn'];
  const tpl = lblActive(),
    { w, h } = tpl,
    cols = Math.floor(210 / w),
    rows = Math.floor(297 / h),
    a4 = S.stSize === 'a4' && cols * rows > 0,
    per = cols * rows,
    imgs = await lblImages(recs);
  const P = prn(),
    lw = P.rot % 180 ? h : w,
    lh = P.rot % 180 ? w : h,
    across = Math.max(1, P.across),
    pageW = +(P.left + across * lw + (across - 1) * P.gap).toFixed(3);
  const css = a4
    ? `@page{size:A4;margin:0}body{margin:0}.pg{width:210mm;height:297mm;display:grid;grid-template-columns:repeat(${cols},${w}mm);grid-auto-rows:${h}mm;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}img{width:${w}mm;height:${h}mm;display:block}`
    : `@page{size:${pageW}mm ${lh}mm;margin:0}html,body{margin:0;padding:0}.pg{position:relative;width:${pageW}mm;height:${lh}mm;overflow:hidden;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}img{position:absolute;top:${P.dy}mm;width:${lw}mm;height:${lh}mm;display:block}`;
  let body = '';
  if (a4)
    for (let i = 0; i < imgs.length; i += per)
      body += `<div class="pg">${imgs
        .slice(i, i + per)
        .map(src => `<img src="${src}">`)
        .join('')}</div>`;
  else
    for (let i = 0; i < imgs.length; i += across)
      body += `<div class="pg">${imgs
        .slice(i, i + across)
        .map((src, j) => `<img src="${src}" style="left:${+(P.left + P.dx + j * (lw + P.gap)).toFixed(3)}mm">`)
        .join('')}</div>`;
  document.getElementById('stFrame')?.remove();
  const fr = document.createElement('iframe');
  fr.id = 'stFrame';
  fr.setAttribute('aria-hidden', 'true');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(fr);
  const d = fr.contentDocument;
  d.open();
  d.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>AssetSync สติกเกอร์</title><style>${css}</style></head><body>${body}</body></html>`
  );
  d.close();
  await Promise.all(
    [...d.images].map(im =>
      im.complete
        ? 0
        : new Promise(r => {
            im.onload = im.onerror = r;
          })
    )
  );
  fr.contentWindow.focus();
  fr.contentWindow.print();
  return [
    `ส่งพิมพ์ ${recs.length} ดวง · ${esc(tpl.name)} (${a4 ? 'A4' : `${w} × ${h} มม.`})${S.stTab === 'xls' ? '' : ' · พิมพ์ครบแล้วกด "บันทึกว่าติดแล้ว"'}`,
    'ok'
  ];
}
async function stickerPdf(test) {
  if (!window.jspdf) return ['โหลดตัวสร้าง PDF ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ', 'bad'];
  const recs = lblRecords(test);
  if (!recs.length) return ['ยังไม่ได้เลือกรายการ', 'warn'];
  const tpl = lblActive(),
    { w, h } = tpl,
    { jsPDF } = window.jspdf,
    cols = Math.floor(210 / w),
    rows = Math.floor(297 / h),
    a4 = S.stSize === 'a4' && cols * rows > 0,
    per = cols * rows;
  const P = prn(),
    lw = P.rot % 180 ? h : w,
    lh = P.rot % 180 ? w : h,
    across = Math.max(1, P.across),
    pw = P.left + across * lw + (across - 1) * P.gap,
    ori = pw >= lh ? 'l' : 'p';
  const pdf = a4
    ? new jsPDF({ unit: 'mm', format: 'a4' })
    : new jsPDF({ unit: 'mm', format: [pw, lh], orientation: ori });
  (await lblImages(recs)).forEach((img, i) => {
    if (!a4) {
      const j = i % across;
      if (i && !j) pdf.addPage([pw, lh], ori);
      pdf.addImage(img, 'PNG', P.left + P.dx + j * (lw + P.gap), P.dy, lw, lh, undefined, 'FAST');
    } else {
      const k = i % per;
      if (i && !k) pdf.addPage();
      pdf.addImage(img, 'PNG', (k % cols) * w, Math.floor(k / cols) * h, w, h, undefined, 'FAST');
    }
  });
  return await save(`AssetSync-สติกเกอร์-${recs.length}ดวง.pdf`, pdf.output('blob'), 'application/pdf');
}
