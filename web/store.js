/* AMS Count · ตัวเชื่อมข้อมูลกับ Supabase
 *
 * หน้าแอปเรียกใช้ที่เก็บข้อมูลผ่านชุดคำสั่งเล็ก ๆ ชุดเดียว (doc / collection)
 * ไฟล์นี้แปลงคำสั่งเหล่านั้นเป็นตาราง Supabase:
 *   meta/round, master/cN        → ตาราง kv (key, data)
 *   ev/<round>-<dev>-<n> {items} → ตาราง events (1 แถวต่อ 1 เหตุการณ์, ส่งซ้ำไม่ซ้ำ)
 * และรับการเปลี่ยนแปลงสดผ่าน Supabase Realtime
 */
(() => {
  const LSK = 'amt.cfg';
  const readCfg = () => {
    let local = {};
    try { local = JSON.parse(localStorage.getItem(LSK) || '{}'); } catch {}
    const base = window.AMS_CONFIG || {};
    return {
      url: (local.url || base.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
      key: (local.key || base.SUPABASE_ANON_KEY || '').trim(),
      domain: (base.LOGIN_DOMAIN || 'ams-count.example.com').trim()
    };
  };

  let sb = null, cfg = readCfg();
  function client() {
    if (sb) return sb;
    if (!cfg.url || !cfg.key || !window.supabase) return null;
    sb = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'amt.auth' },
      realtime: { params: { eventsPerSecond: 20 } }
    });
    return sb;
  }

  const emailOf = code => `${String(code).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@${cfg.domain}`;
  const passOf = (code, pin) => `AMS-${String(pin).trim()}-${String(code).trim()}`;
  const err = (e, fallback) => { const x = new Error((e && (e.message || e.error_description)) || fallback || 'error'); x.code = e?.code || e?.status; return x; };

  /* ---------- auth + team ---------- */
  const auth = {
    configured: () => !!(cfg.url && cfg.key),
    config: () => ({ ...cfg }),
    setConfig(url, key) {
      try { localStorage.setItem(LSK, JSON.stringify({ url, key })); } catch {}
      cfg = readCfg(); sb = null;
    },
    async session() { const c = client(); if (!c) return null; const { data } = await c.auth.getSession(); return data.session || null; },
    async login(code, pin) {
      const c = client(); if (!c) throw err(null, 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ');
      const { data, error } = await c.auth.signInWithPassword({ email: emailOf(code), password: passOf(code, pin) });
      if (error) throw err(error, 'เข้าสู่ระบบไม่สำเร็จ');
      return data.session;
    },
    async logout() { try { await client()?.auth.signOut(); } catch {} },
    async profile() {
      const c = client(); const s = await auth.session(); if (!c || !s) return null;
      const { data, error } = await c.from('profiles').select('id,code,name,role,active').eq('id', s.user.id).maybeSingle();
      if (error) throw err(error);
      return data;
    },
    async anyUser() {
      // true เมื่อมีบัญชีในระบบแล้ว (ดูจากการสมัครหัวหน้าคนแรกไม่ได้อีก) — ใช้ RPC ที่ไม่เปิดเผยข้อมูล
      const c = client(); if (!c) return true;
      const { data, error } = await c.rpc('ams_has_users');
      if (error) return true;
      return !!data;
    },
    async firstLead(name, code, pin) {
      const c = client();
      const { data, error } = await c.auth.signUp({ email: emailOf(code), password: passOf(code, pin), options: { data: { code, name } } });
      if (error) throw err(error, 'สร้างบัญชีไม่สำเร็จ');
      if (!data.session) throw err(null, 'สร้างบัญชีแล้ว แต่ Supabase ยังเปิด "Confirm email" อยู่ — ปิดตามคู่มือข้อ 3 แล้วเข้าสู่ระบบอีกครั้ง');
      return data.session;
    },
    async team() {
      const c = client(); if (!c) return [];
      const { data, error } = await c.from('profiles').select('id,code,name,role,active').order('role').order('name');
      if (error) throw err(error);
      return data || [];
    },
    async addMember(name, code, pin, role) {
      // สมัครบัญชีด้วยตัวเชื่อมแยก เพื่อไม่ให้หัวหน้าหลุดจากระบบ แล้วหัวหน้าเปิดใช้ + กำหนดบทบาท
      const tmp = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'amt.tmp' } });
      const { data, error } = await tmp.auth.signUp({ email: emailOf(code), password: passOf(code, pin), options: { data: { code, name } } });
      if (error) throw err(error, 'สร้างบัญชีไม่สำเร็จ');
      const id = data.user?.id; if (!id) throw err(null, 'สร้างบัญชีไม่สำเร็จ');
      const { error: e2 } = await client().from('profiles').update({ active: true, role, name }).eq('id', id);
      if (e2) throw err(e2);
      return id;
    },
    async updateMember(id, patch) {
      const { error } = await client().from('profiles').update(patch).eq('id', id);
      if (error) throw err(error);
    },
    async deleteMember(id) {
      const { error } = await client().rpc('ams_delete_user', { p_user: id });
      if (error) { const e = err(error); if (/ams_delete_user|function|schema cache/i.test(error.message || '') && !/เฉพาะ|ตัวเอง/.test(error.message || '')) { e.message = 'ยังไม่ได้เพิ่มคำสั่งลบในฐานข้อมูล · ให้ Admin รันไฟล์ supabase/add-delete-user.sql ใน Supabase ก่อน'; } throw e; }
    },
    async setPin(id, code, pin) {
      const { error } = await client().rpc('ams_set_pin', { p_user: id, p_password: passOf(code, pin) });
      if (error) throw err(error);
    }
  };

  /* ---------- data store (doc / collection) ---------- */
  const rowOf = e => ({ id: e.id, round: e.round, dev: e.dev, t: e.t, k: e.k, code: e.code, by_name: e.by || null, data: e });
  const sentIds = new Set();   // เหตุการณ์ที่ระบบยืนยันแล้ว ไม่ต้องส่งซ้ำ

  async function fetchEvents(round, dev) {
    const c = client(), out = [];
    for (let from = 0; ; from += 1000) {
      let q = c.from('events').select('data').eq('round', round).order('t').order('id').range(from, from + 999);
      if (dev) q = q.eq('dev', dev);
      const { data, error } = await q;
      if (error) throw err(error);
      for (const r of data) { out.push(r.data); sentIds.add(r.data.id); }
      if (data.length < 1000) break;
    }
    return out;
  }
  // a row the database refuses for good (no permission, bad value) must not hold back everything after it
  const refused = e => !!e && /^(42501|23514|23502|22P02|PGRST)/.test(String(e.code || '')) || /row-level security|violates/i.test(e?.message || '');
  const rejected = new Map();   // id → reason · shown on the device, never retried
  async function putEvents(items) {
    const fresh = items.filter(e => e && e.id && !sentIds.has(e.id) && !rejected.has(e.id));
    for (let i = 0; i < fresh.length; i += 500) {
      const part = fresh.slice(i, i + 500);
      const { error } = await client().from('events').upsert(part.map(rowOf), { onConflict: 'id', ignoreDuplicates: true });
      if (!error) { part.forEach(e => sentIds.add(e.id)); continue; }
      if (!refused(error)) throw err(error);
      for (const e of part) {   // send one by one, set aside only the refused rows
        const r = await client().from('events').upsert([rowOf(e)], { onConflict: 'id', ignoreDuplicates: true });
        if (!r.error) sentIds.add(e.id); else if (refused(r.error)) rejected.set(e.id, r.error.message || 'refused'); else throw err(r.error);
      }
    }
  }
  async function kvGet(key) {
    const { data, error } = await client().from('kv').select('data').eq('key', key).maybeSingle();
    if (error) throw err(error);
    return data ? data.data : null;
  }
  const snapDoc = (key, d) => ({ exists: d != null, id: key.split('/').pop(), data: () => d ?? undefined });

  // ฟังการเปลี่ยนแปลง + ดึงใหม่ทั้งชุดเมื่อกลับมาออนไลน์ (กันพลาดช่วงที่หลุด)
  const resyncers = new Set();
  const resyncAll = () => resyncers.forEach(f => f());
  window.addEventListener('online', resyncAll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resyncAll(); });
  setInterval(() => { if (navigator.onLine) resyncAll(); }, 60000);

  function watchKv(key, cb, onErr) {
    let last, alive = true;
    const push = d => { const s = JSON.stringify(d ?? null); if (s !== last) { last = s; cb(snapDoc(key, d)); } };
    const pull = () => kvGet(key).then(d => alive && push(d), e => alive && onErr?.(e));
    const ch = client().channel('kv-' + key.replace(/\W/g, '_') + '-' + Math.random().toString(36).slice(2, 6))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kv', filter: `key=eq.${key}` }, p => {
        if (p.eventType === 'DELETE') push(null); else push(p.new?.data);
      })
      .subscribe(st => { if (st === 'SUBSCRIBED') pull(); else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') onErr?.(err(null, st)); });
    resyncers.add(pull); pull();
    return () => { alive = false; resyncers.delete(pull); client().removeChannel(ch); };
  }
  function watchEvents(round, cb, onErr) {
    const all = new Map(); let alive = true, t = null;
    const emit = () => { clearTimeout(t); t = setTimeout(() => alive && cb({ docs: [{ id: 'srv', exists: true, data: () => ({ round, items: [...all.values()] }) }] }), 120); };
    const pull = () => fetchEvents(round).then(list => { if (!alive) return; for (const e of list) all.set(e.id, e); emit(); }, e => alive && onErr?.(e));
    const ch = client().channel('ev-' + round + '-' + Math.random().toString(36).slice(2, 6))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `round=eq.${round}` }, p => {
        const d = p.new?.data; if (d && d.id) { all.set(d.id, d); sentIds.add(d.id); emit(); }
      })
      .subscribe(st => { if (st === 'SUBSCRIBED') pull(); else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') onErr?.(err(null, st)); });
    resyncers.add(pull); pull();
    return () => { alive = false; resyncers.delete(pull); client().removeChannel(ch); };
  }

  const db = {
    rejected: () => rejected,
    doc(path) {
      const [col, ...rest] = path.split('/'), id = rest.join('/');
      if (col === 'ev') return {
        async set(d) { await putEvents((d.items || []).map(e => ({ ...e, round: e.round || d.round, dev: e.dev || d.dev }))); }
      };
      return {
        async get() { return snapDoc(path, await kvGet(path)); },
        async set(d) { const { error } = await client().from('kv').upsert({ key: path, data: d, updated_at: new Date().toISOString() }); if (error) throw err(error); },
        async delete() { const { error } = await client().from('kv').delete().eq('key', path); if (error) throw err(error); },
        onSnapshot(cb, onErr) { return watchKv(path, cb, onErr); }
      };
    },
    collection(col) {
      const conds = {};
      const q = {
        where(f, op, v) { conds[f] = v; return q; },
        async get() { const items = await fetchEvents(conds.round, conds.dev); return { docs: [{ id: 'srv', exists: true, data: () => ({ round: conds.round, dev: conds.dev, items }) }] }; },
        onSnapshot(cb, onErr) { return watchEvents(conds.round, cb, onErr); }
      };
      return q;
    },
    async deleteRound(round) { const { error } = await client().from('events').delete().eq('round', round); if (error) throw err(error); },
    async deleteKeys(prefix) { const { error } = await client().from('kv').delete().like('key', prefix + '%'); if (error) throw err(error); },
    // who is online right now (Supabase Realtime presence · nothing stored) → cb({ dev: state })
    presence(room, cb) {
      let me = null, ready = false;
      const ch = client().channel('pr-' + room, { config: { presence: { key: 'k' + Math.random().toString(36).slice(2, 8) } } });
      const sync = () => { const st = ch.presenceState() || {}, out = {}; for (const k in st) for (const x of st[k] || []) if (x && x.dev) out[x.dev] = x; cb(out); };
      ch.on('presence', { event: 'sync' }, sync).on('presence', { event: 'join' }, sync).on('presence', { event: 'leave' }, sync)
        .subscribe(st => { if (st === 'SUBSCRIBED') { ready = true; if (me) ch.track(me).catch(() => {}); } });
      return { set(state) { me = { ...state, at: Date.now() }; if (ready) ch.track(me).catch(() => {}); }, stop() { client().removeChannel(ch); } };
    }
  };

  /* ---------- files: Android app saves to Download/AssetSync, browser downloads ---------- */
  const blobToB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const downloads = {
    async save({ filename, data, type }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
      if (window.AndroidBridge && window.AndroidBridge.saveFile) {
        const r = String(window.AndroidBridge.saveFile(filename, await blobToB64(blob), blob.type || type || 'application/octet-stream'));
        if (r.startsWith('OK')) return { status: 'saved', where: r.slice(3) || 'Download' };
        const e = new Error(r.replace(/^ERR:/, '')); e.code = 'save_failed'; throw e;
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return { status: 'saved', where: 'โฟลเดอร์ดาวน์โหลด' };
    }
  };

  window.AMSStore = { auth, db, downloads, isApp: !!window.AndroidBridge };
})();
