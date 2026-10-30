/* AssetSync · รับรหัสจากเครื่องยิง: Intent ของ Android, คีย์บอร์ด และปุ่มย้อนกลับ */
// 1) Android app receives the scan as an Intent (CipherLab "Intent" output) → window.AMSScan(code)
// 2) Keyboard Emulation while the scan box isn't focused → collect keys here
// 3) Keyboard Emulation without Enter suffix → submit after a short pause
const scanLog = [];
function logScan(how, v) {
  scanLog.unshift({ t: Date.now(), how, v: String(v).slice(0, 60) });
  scanLog.length = Math.min(scanLog.length, 8);
  if (S.app === 'me') render();
}
function routeScan(code) {
  code = String(code || '')
    .replace(/[\r\n\t]+/g, '')
    .trim();
  if (!code) return;
  if (S.mode !== 'app' || !S.user || !meta) {
    flash('ได้รับรหัส ' + stripType(code) + ' · เข้าหน้าแอปแล้วเลือกพื้นที่ก่อน');
    return;
  }
  if (!S.area) {
    flash('ได้รับรหัส ' + stripType(code) + ' · เลือกพื้นที่ที่อยู่ตอนนี้ก่อน');
    S.app = 'area';
    S.areaPick = true;
    render();
    return;
  }
  if (S.item) S.item = null;
  if (S.app !== 'scan') S.app = 'scan';
  doScan(code);
}
// the Android app downloaded a newer set of screens from the web (see MainActivity.checkWebUpdate)
window.AMSUpdate = (r, manual) => {
  if (r.startsWith('ready:')) {
    S.updReady = r.slice(6);
    render();
    return;
  }
  if (manual)
    flash(
      r === 'latest'
        ? 'เป็นเวอร์ชันล่าสุดแล้ว'
        : r === 'apk'
          ? 'ต้องติดตั้งแอปใหม่'
          : 'ตรวจอัปเดตไม่ได้ · ' + r.replace(/^error:/, '')
    );
};
window.AMSScan = code => {
  logScan('Intent', code);
  routeScan(code);
  return true;
};
let keyBuf = '',
  keyT = 0,
  keyTimer = null;
document.addEventListener(
  'keydown',
  e => {
    const a = document.activeElement,
      typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.id !== 'scanIn';
    if (typing || S.mode !== 'app' || !S.user || S.gate) return; // never record keys typed into other boxes (PIN, names)
    if (e.key && (e.key.length === 1 || e.key === 'Enter'))
      logScan('ปุ่ม ' + (a?.id === 'scanIn' ? 'ช่องสแกน' : 'นอกช่องสแกน'), e.key === 'Enter' ? '⏎ Enter' : e.key);
    if (a && a.id === 'scanIn') {
      // no Enter suffix configured: send automatically when the burst stops
      if (!S.manual && e.key.length === 1) {
        clearTimeout(keyTimer);
        keyTimer = setTimeout(() => {
          const i = $('#scanIn');
          if (i && i.value.trim().length >= 3) {
            const v = i.value;
            i.value = '';
            logScan('ส่งอัตโนมัติ', v);
            doScan(v);
          }
        }, 350);
      }
      if (e.key === 'Enter') clearTimeout(keyTimer);
      return;
    }
    const now = Date.now();
    if (now - keyT > 600) keyBuf = '';
    keyT = now;
    if (e.key === 'Enter') {
      if (keyBuf.length >= 3) {
        e.preventDefault();
        const v = keyBuf;
        keyBuf = '';
        routeScan(v);
      }
      return;
    }
    if (e.key.length === 1) {
      keyBuf += e.key;
      clearTimeout(keyTimer);
      keyTimer = setTimeout(() => {
        if (keyBuf.length >= 4) {
          const v = keyBuf;
          keyBuf = '';
          routeScan(v);
        }
        keyBuf = '';
      }, 350);
    }
  },
  true
);
document.addEventListener('focusout', () => {
  if (S.mode === 'app' && S.app === 'scan' && !S.item && !S.areaPick)
    setTimeout(() => {
      const a = document.activeElement;
      if (!a || a === document.body) $('#scanIn')?.focus({ preventScroll: true });
    }, 50);
});

// Android back button: close sheet → go to home tab → leave app
window.AMSBack = () => {
  if (S.dupPop || S.othPop || S.subPop) {
    S.dupPop = null;
    S.othPop = null;
    S.subPop = null;
    render();
    return true;
  }
  if (S.item || S.areaPick || S.search) {
    if (S.item) S.item = null;
    else {
      S.areaPick = false;
      S.search = null;
    }
    render();
    return true;
  }
  if (S.mode === 'app' && S.user && S.app !== 'home') {
    S.app = 'home';
    render();
    return true;
  }
  if (S.mode === 'web' && S.web !== 'rounds' && S.web !== 'live') {
    S.web = isLead() ? 'rounds' : 'live';
    render();
    return true;
  }
  return false;
};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (S.item || S.areaPick)) {
    S.item = null;
    S.areaPick = false;
    render();
  }
});
