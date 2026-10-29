/* AssetSync · เมนู 4.1 Pivot Report (โหลด PivotTable.js เมื่อเปิดแท็บ) */
const PV_LIBS = [
  ['css', 'lib/pivot.min.css'],
  ['js', 'lib/jquery.min.js'],
  ['js', 'lib/jquery-ui.min.js'],
  ['js', 'lib/pivot.min.js']
];
let pvLoading = null;
function loadPivot() {
  if (window.jQuery?.fn?.pivotUI) return Promise.resolve();
  return (
    pvLoading ||
    (pvLoading = PV_LIBS.reduce(
      (p, [kind, src]) =>
        p.then(
          () =>
            new Promise((ok, bad) => {
              const inl = document.getElementById('lazy-' + src.split('/').pop()); // review copy carries the files inline
              if (kind === 'css') {
                const st = document.createElement(inl ? 'style' : 'link');
                if (inl) st.textContent = inl.textContent;
                else {
                  st.rel = 'stylesheet';
                  st.href = src;
                }
                document.head.appendChild(st);
                return ok();
              }
              const sc = document.createElement('script');
              if (inl) {
                sc.textContent = inl.textContent;
                document.head.appendChild(sc);
                return ok();
              }
              sc.src = src;
              sc.onload = ok;
              sc.onerror = () => bad(new Error('โหลด ' + src + ' ไม่ได้'));
              document.head.appendChild(sc);
            })
        ),
      Promise.resolve()
    ))
  );
}
function pivotRecords() {
  const { cur } = compute(),
    H = (meta.headers || []).map(h => String(h).trim()),
    out = [];
  const num = v => {
    if (typeof v === 'number') return v;
    const t = String(v ?? '')
      .replace(/,/g, '')
      .trim();
    return t !== '' && !isNaN(Number(t)) && /^-?[\d.]+$/.test(t) && !/^0\d/.test(t) ? Number(t) : v;
  };
  for (const a of master.values()) {
    if (!counted(a)) continue;
    const s2 = cur.get(a.code),
      L = !s2 && lostOf(a.code);
    const res = {
      ผลการนับ: s2
        ? isBorrowed(s2)
          ? 'ยืมมา'
          : isMoveCase(s2)
            ? 'ต้องย้าย CC'
            : 'ตรวจแล้ว'
        : L
          ? 'สูญหาย'
          : 'ยังไม่พบ',
      สภาพ: s2?.cond || '',
      'CC ที่พบ': s2 ? String(s2.area) : '',
      'ชื่อ CC ที่พบ': s2?.areaName || '',
      ผู้นับ: s2?.by || '',
      วิธีตรวจนับ: s2 ? SRC[s2.src][0] : '',
      QR: !s2 ? '' : hasQR(s2) ? 'ครบ' : s2.printedAt ? 'ติดแล้ว' : 'ต้องสร้าง',
      สถานะย้าย: s2 && isMoveCase(s2) ? (s2.rv.move === 'approved' ? 'รอโอนย้าย' : 'รออนุมัติ') : '',
      วันที่นับ: s2 ? new Date(s2.t).toLocaleDateString('th-TH') : '',
      'ปิดงาน CC': ccClosed(a.cc) ? 'ปิดแล้ว' : 'ยังไม่ปิด'
    };
    for (const raw of a.raws.length ? a.raws : [[]]) {
      const rec = {};
      H.forEach((h, i) => {
        if (h) rec[h] = num(raw[i] ?? '');
      });
      out.push(Object.assign(rec, res));
    }
  }
  // only what the imported file really has (drop its blank answer columns) + the count results
  const empty = H.filter(h => h && out.every(r => r[h] === '' || r[h] == null));
  for (const r of out) for (const h of empty) delete r[h];
  return out;
}
async function mountPivot() {
  const box = $('#pivotBox');
  if (!box || box.dataset.ready === _cacheKey + meta.id) return;
  try {
    await loadPivot();
  } catch (e) {
    box.innerHTML = `<div class="msg bad">${esc(e.message)}</div>`;
    return;
  }
  const jq = window.jQuery,
    U = jq.pivotUtilities,
    T = U.aggregatorTemplates,
    nf = U.numberFormat({ thousandsSep: ',', decimalSep: '.', digitsAfterDecimal: 0 }),
    nf2 = U.numberFormat({ thousandsSep: ',', decimalSep: '.', digitsAfterDecimal: 2 });
  const H = (meta.headers || []).map(h => String(h).trim()),
    m0 = meta.map || {},
    ccH = H[m0.cc ?? -1] || H.find(h => /COST CE/i.test(h)) || 'ผลการนับ';
  const saved = LS.get('pv-' + meta.id, null) || {
    rows: [ccH],
    cols: ['ผลการนับ'],
    vals: [],
    aggregatorName: 'จำนวน',
    rendererName: 'ตาราง'
  };
  jq(box).pivotUI(
    pivotRecords(),
    {
      rows: saved.rows,
      cols: saved.cols,
      vals: saved.vals,
      aggregatorName: saved.aggregatorName,
      rendererName: saved.rendererName,
      inclusions: saved.inclusions || {},
      exclusions: saved.exclusions || {},
      aggregators: {
        จำนวน: T.count(nf),
        นับไม่ซ้ำ: T.countUnique(nf),
        ผลรวม: T.sum(nf2),
        เฉลี่ย: T.average(nf2),
        ต่ำสุด: T.min(nf2),
        สูงสุด: T.max(nf2),
        'จำนวน (% ของทั้งหมด)': T.fractionOf(T.count(), 'total'),
        'ผลรวม (% ของทั้งหมด)': T.fractionOf(T.sum(), 'total')
      },
      renderers: {
        ตาราง: U.renderers['Table'],
        'ตาราง + แถบ': U.renderers['Table Barchart'],
        'ไล่สี (Heatmap)': U.renderers['Heatmap']
      },
      unusedAttrsVertical: true,
      menuLimit: 2000,
      rendererOptions: { localeStrings: { totals: 'รวม', vs: 'กับ', by: 'ตาม' } },
      localeStrings: {
        renderError: 'สร้างตารางไม่ได้',
        computeError: 'คำนวณไม่ได้',
        uiRenderError: 'แสดงหน้าจอไม่ได้',
        selectAll: 'เลือกทั้งหมด',
        selectNone: 'ไม่เลือก',
        tooMany: '(มีมากเกินไป)',
        filterResults: 'ค้นหา',
        apply: 'ตกลง',
        cancel: 'ยกเลิก',
        totals: 'รวม',
        vs: 'กับ',
        by: 'ตาม'
      },
      onRefresh: c => {
        try {
          LS.set('pv-' + meta.id, {
            rows: c.rows,
            cols: c.cols,
            vals: c.vals,
            aggregatorName: c.aggregatorName,
            rendererName: c.rendererName,
            inclusions: c.inclusions,
            exclusions: c.exclusions
          });
        } catch {}
      }
    },
    true
  );
  box.dataset.ready = _cacheKey + meta.id;
}
