/* AssetSync · บันทึก/โหลดข้อมูลกับ Supabase: ผลนับ, งาน (jobs), ทะเบียน, ใครออนไลน์, ตรวจว่าส่งครบ และโหลดสำเนาในเครื่องตอนเปิด */
function scheduleFlush() {
  clearTimeout(scheduleFlush.t);
  scheduleFlush.t = setTimeout(flush, 700);
}
async function flush() {
  if (!db || !meta || writing || !dirty.size) {
    paintSync();
    return;
  }
  writing = true;
  paintSync();
  try {
    for (const k of [...dirty]) {
      const items = mine.slice(k * CHUNK, (k + 1) * CHUNK);
      await db.doc(`ev/${meta.id}-${dev}-${k}`).set({ round: meta.id, dev, items, at: Date.now() });
      dirty.delete(k);
      saveMine();
    }
    online = true;
  } catch (e) {
    online = false;
    clearTimeout(flush.r);
    flush.r = setTimeout(flush, 8000);
  }
  writing = false;
  paintSync();
  render();
}
function pushEvent(e) {
  if (!meta) return;
  const ev = {
    id: dev + '-' + Date.now().toString(36) + '-' + mine.length,
    t: Date.now(),
    by: S.user?.name || '?',
    dev,
    ...e
  };
  mine.push(ev);
  dirty.add(Math.floor((mine.length - 1) / CHUNK));
  saveMine();
  _cache = null;
  scheduleFlush();
  return ev;
}
function pendingCount() {
  if (!db) return 0;
  const rej = db.rejected ? db.rejected() : null;
  return mine.filter(e => !isServer(e.id) && !(rej && rej.has(e.id))).length;
}
// ---------- jobs: every imported file is its own job (meta/<id>, master/<id>/cN); the old single round is meta/round ----------
let jobs = LS.get('jobs', null),
  jobId = LS.get('jobId', null);
const metaKeyOf = m => m?.metaKey || 'meta/round';
const masterKeyOf = (m, i) => (m?.masterKey || 'master/c') + i;
const jobEntry = m => ({
  id: m.id,
  name: m.name,
  status: m.status,
  createdAt: m.createdAt || 0,
  closedAt: m.closedAt || 0,
  fileName: m.fileName || '',
  total: m.total ?? null,
  areas: (m.areas || []).filter(a => !a.shared).length,
  metaKey: metaKeyOf(m),
  masterKey: m.masterKey || 'master/c'
});
const jobList = () =>
  (jobs && jobs.length ? jobs : meta ? [jobEntry(meta)] : [])
    .slice()
    .sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || b.createdAt - a.createdAt);
async function saveJobs(list) {
  jobs = list;
  LS.set('jobs', list);
  if (db && isLead()) await db.doc('jobs').set({ list });
}
async function saveMeta(m) {
  if (m && !usbMode && S.team.length)
    m = { ...m, team: S.team.filter(u => u.active).map(u => ({ name: u.name, role: u.role, code: u.code })) };
  meta = m;
  LS.set('meta', m);
  if (db) {
    try {
      if (m) {
        await db.doc(metaKeyOf(m)).set(m);
        await saveJobs([jobEntry(m), ...(jobs || []).filter(j => j.id !== m.id)]);
      }
      online = true;
    } catch (e) {
      online = false;
      flash('บันทึกขึ้นระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }
  _cache = null;
  render();
}
async function saveMaster(rows, m) {
  indexMaster(rows);
  LS.set('master', rows);
  const parts = [];
  let cur = [],
    size = 0;
  for (const r of rows) {
    const n = new TextEncoder().encode(JSON.stringify(r)).length;
    if (size + n > 190000 && cur.length) {
      parts.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(r);
    size += n;
  }
  if (cur.length) parts.push(cur);
  m.ver = 'v' + Date.now();
  m.chunks = parts.length;
  if (db)
    for (let i = 0; i < parts.length; i++) {
      flash(`กำลังส่งทะเบียนขึ้นระบบ ${i + 1}/${parts.length}`);
      await db.doc(masterKeyOf(m, i)).set({ ver: m.ver, rows: parts[i] });
    }
  LS.set('masterVer', m.ver);
  await saveMeta(m);
}
let unsubEv = null,
  evRound = null,
  unsubMeta = null;
function subscribeEvents() {
  if (!db || !meta || evRound === meta.id) return;
  if (unsubEv) unsubEv();
  evRound = meta.id;
  serverEv = {};
  unsubEv = db
    .collection('ev')
    .where('round', '==', meta.id)
    .onSnapshot(
      snap => {
        const m = {};
        for (const d of snap.docs) {
          const x = d.data();
          if (x) m[d.id] = x.items || [];
        }
        serverEv = m;
        online = true;
        _cache = null;
        render();
      },
      () => {
        online = false;
        paintSync();
      }
    );
}
async function loadMaster(m) {
  const rows = [];
  for (let i = 0; i < m.chunks; i++) {
    const d = (await db.doc(masterKeyOf(m, i)).get()).data();
    if (!d || d.ver !== m.ver) return false;
    rows.push(...d.rows);
  }
  indexMaster(rows);
  LS.set('master', rows);
  LS.set('masterVer', m.ver);
  return true;
}
// the register must reach every device: keep retrying until this device has the version the round says
function retryMaster() {
  clearTimeout(retryMaster.t);
  retryMaster.t = setTimeout(async () => {
    if (!db || !meta?.ver || meta.ver === LS.get('masterVer', null)) return;
    if (await loadMaster(meta).catch(() => false)) {
      _cache = null;
      flash('โหลดทะเบียนครบแล้ว');
      render();
    } else retryMaster();
  }, 10000);
}
setInterval(() => {
  if (db && meta?.ver && meta.ver !== LS.get('masterVer', null)) retryMaster();
}, 30000);
async function loadTeam() {
  try {
    S.team = await Store.auth.team();
    LS.set('team', S.team);
  } catch {}
}
async function connect() {
  dl = await cap('downloads');
  if (usbMode) {
    S.gate = null;
    paintSync();
    render();
    return;
  } // cable mode: no online database, files only
  if (!Store.auth.configured()) {
    S.gate = 'setup';
    render();
    return;
  }
  let sess = null;
  try {
    sess = await Store.auth.session();
  } catch {}
  if (!sess) {
    S.gate = 'login';
    S.authed = false;
    S.firstRun = !(await Store.auth.anyUser().catch(() => true));
    render();
    return;
  }
  try {
    const p = await Store.auth.profile();
    if (!p) {
      S.gate = 'login';
      render();
      return;
    }
    if (!p.active) {
      S.gate = 'inactive';
      S.user = { id: p.id, name: p.name, code: p.code, role: p.role };
      render();
      return;
    }
    S.user = { id: p.id, name: p.name, code: p.code, role: p.role };
    LS.set('user', S.user);
    await loadTeam();
  } catch (e) {
    // no internet: keep working with the account saved on this device
    if (!S.user) {
      S.gate = 'login';
      S.gateMsg = 'ยังไม่มีอินเทอร์เน็ต · ต้องเข้าสู่ระบบออนไลน์ครั้งแรกก่อน';
      render();
      return;
    }
  }
  S.gate = null;
  S.authed = true;
  db = await cap('db');
  if (!db) {
    paintSync();
    render();
    return;
  }
  unsubJobs?.();
  unsubJobs = db.doc('jobs').onSnapshot(
    s => {
      const list = s.exists ? s.data().list || [] : null;
      jobs = list;
      LS.set('jobs', list);
      watchJob();
      render();
    },
    () => {
      online = false;
      paintSync();
    }
  );
}
function curJobKey() {
  if (!jobs || !jobs.length) return 'meta/round';
  const j = jobs.find(x => x.id === jobId) || jobs.find(x => x.status !== 'closed') || jobs[0];
  return j.metaKey;
}
let watchedKey = null,
  unsubJobs = null;
function watchJob() {
  const k = curJobKey();
  if (k === watchedKey && unsubMeta) return;
  watchedKey = k;
  unsubMeta?.();
  unsubMeta = db.doc(k).onSnapshot(
    async s => {
      const m = s.exists ? s.data() : null;
      const roundChanged = (m?.id || null) !== (meta?.id || null);
      if (m && m.ver && m.ver !== LS.get('masterVer', null)) {
        flash('กำลังโหลดทะเบียน…');
        if (!(await loadMaster(m).catch(() => false))) {
          flash('ทะเบียนยังโหลดไม่ครบ · กำลังลองใหม่');
          retryMaster();
        }
      }
      if (m && (!jobs || !jobs.length)) {
        jobs = [jobEntry(m)];
        LS.set('jobs', jobs);
      } // the old single round becomes the first job
      meta = m;
      LS.set('meta', m);
      if (roundChanged) {
        loadMine();
        evRound = null;
        S.area = null;
        LS.set('area', null);
        S.cards = [];
      }
      subscribeEvents();
      startPresence();
      online = true;
      _cache = null;
      render();
      if (dirty.size) flush();
      flushOtherJobs();
    },
    () => {
      online = false;
      paintSync();
    }
  );
}
async function deleteJob(id) {
  const j = jobList().find(x => x.id === id);
  if (!j) return;
  try {
    if (db) {
      await Store.db.deleteRound(j.id);
      await db.doc(j.metaKey).delete();
      await Store.db.deleteKeys(j.masterKey);
    }
    await saveJobs(jobList().filter(x => x.id !== id));
  } catch (e) {
    flash('ลบไม่สำเร็จ: ' + e.message);
    return;
  }
  LS.set('mine-' + id, []);
  LS.set('dirty-' + id, []);
  if (meta?.id === id) {
    meta = null;
    LS.set('meta', null);
    mine = [];
    serverEv = {};
    S.cards = [];
    jobId = null;
    LS.set('jobId', null);
    watchedKey = null;
    if (db) watchJob();
  }
  flash('ลบงานแล้ว');
  render();
}
// counts made in another job (or by cable) still waiting to be sent: send them too, whichever job is open now
async function flushOtherJobs() {
  if (!db || usbMode) return;
  for (const j of jobList()) {
    if (j.id === meta?.id) continue;
    const d = LS.get('dirty-' + j.id, []);
    if (!d.length) continue;
    const list = LS.get('mine-' + j.id, []);
    try {
      for (const k of d)
        await db
          .doc(`ev/${j.id}-${dev}-${k}`)
          .set({ round: j.id, dev, items: list.slice(k * CHUNK, (k + 1) * CHUNK), at: Date.now() });
      LS.set('dirty-' + j.id, []);
    } catch {
      return;
    }
  }
}
function pickJob(id) {
  if (id === meta?.id) return;
  jobId = id;
  LS.set('jobId', id);
  S.cards = [];
  S.ccSel = null;
  if (db) watchJob();
  flash('กำลังเปิดงาน…');
}

// ---------- who is online: each device says where it is counting (nothing stored) ----------
let pres = null,
  presRoom = null;
S.pres = {};
const presState = () => ({
  dev,
  by: S.user?.name || '',
  role: S.user?.role || (S.mode === 'web' ? 'lead' : 'counter'),
  mode: S.mode,
  area: S.area?.code || null,
  areaName: S.area?.name || null
});
function startPresence() {
  if (!db || !Store.db.presence || !meta || usbMode) return;
  if (presRoom !== meta.id) {
    pres?.stop();
    presRoom = meta.id;
    S.pres = {};
    pres = Store.db.presence(meta.id, st => {
      S.pres = st;
      if (
        S.mode === 'web' &&
        (S.web === 'live' || S.web === 'cc') &&
        !document.activeElement?.matches?.('input,select,textarea')
      )
        render();
    });
  }
  pres.set(presState());
}
setInterval(() => {
  if (pres) pres.set(presState());
}, 45000);

window.addEventListener('online', () => {
  if (db) flush();
});
/* ================= boot from this browser's copy ================= */
meta = LS.get('meta', null);
indexMaster(LS.get('master', []));
loadMine();
async function verify() {
  if (!db) {
    S.verify = [`ผลนับในเครื่องนี้ ${mine.length} รายการ · ยังไม่ได้เชื่อมฐานข้อมูลออนไลน์`, 'warn'];
    return;
  }
  await flush();
  try {
    const snap = await db.collection('ev').where('round', '==', meta.id).where('dev', '==', dev).get();
    const ids = new Set();
    for (const d of snap.docs) for (const x of d.data().items || []) ids.add(x.id);
    const miss = mine.filter(x => !ids.has(x.id));
    const rej = db.rejected ? db.rejected() : new Map(),
      missOk = miss.filter(x => !rej.has(x.id));
    if (miss.length && !missOk.length) {
      S.verify = [
        `ส่งไม่ได้ ${miss.length} รายการ · ระบบไม่อนุญาต (${[...new Set(miss.map(x => rej.get(x.id)))].join(', ').slice(0, 120)}) · แจ้ง Admin`,
        'bad'
      ];
      return;
    }
    S.verify = missOk.length
      ? [`ยังไม่ถึงระบบ ${missOk.length} รายการ · กดอีกครั้ง`, 'bad']
      : [`ครบ ✓ ในเครื่อง ${mine.length} = บนระบบ ${ids.size} · ${fmtT(Date.now())}`, 'ok'];
    if (miss.length) {
      mine.forEach((_, i) => dirty.add(Math.floor(i / CHUNK)));
      saveMine();
      flush();
    }
  } catch (e) {
    S.verify = ['ตรวจไม่ได้ตอนนี้ (ออฟไลน์?)', 'bad'];
  }
}
