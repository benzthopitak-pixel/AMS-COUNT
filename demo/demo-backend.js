/* AMS Count · ตัวอย่างสำหรับรีวิว (ไม่ได้เชื่อม Supabase)
 * จำลองชุดคำสั่ง supabase-js ที่แอปใช้ ข้อมูลอยู่ในหน่วยความจำของหน้านี้ + เก็บไว้ในเบราว์เซอร์
 */
(() => {
  const KEY = 'amt.demoState';
  const seedEl = document.getElementById('demo-seed');
  const fresh = () => JSON.parse(seedEl.textContent);
  // a different seed (new review file) wipes what this browser kept from the old one
  const seedTxt = seedEl.textContent; let h = 0; for (let i = 0; i < seedTxt.length; i += 97) h = (h * 31 + seedTxt.charCodeAt(i)) | 0;
  const sig = seedTxt.length + ':' + h;
  try { if (localStorage.getItem('amt.demoSeed') !== sig) { Object.keys(localStorage).filter(k => k.startsWith('amt.')).forEach(k => localStorage.removeItem(k)); localStorage.setItem('amt.demoSeed', sig); } } catch {}
  let T;
  try { T = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { T = null; }
  if (!T || !T.kv) T = fresh();
  let saveT = null;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch {} }, 400); };
  window.AMSDemoReset = () => { try { Object.keys(localStorage).filter(k => k.startsWith('amt.') && k !== 'amt.demoSeed').forEach(k => localStorage.removeItem(k)); } catch {} location.reload(); };

  // always signed in as the demo Admin
  try { if (!localStorage.getItem('amt.auth')) localStorage.setItem('amt.auth', JSON.stringify({ access_token: 'demo', user: { id: 'u1' } })); } catch {}

  const chans = [];
  const push = ch => setTimeout(() => {
    for (const c of chans) for (const l of c.ls) {
      if (l.f.table !== ch.table) continue;
      if (l.f.event !== '*' && l.f.event !== ch.eventType) continue;
      if (l.f.filter) { const [col, v] = l.f.filter.split('=eq.'); const row = ch.new || ch.old || {}; if (String(row[col]) !== v) continue; }
      try { l.cb(ch); } catch (e) { console.error(e); }
    }
  }, 0);
  const role = uid => { const p = T.profiles.find(x => x.id === uid && x.active); return p ? p.role : null; };
  const clone = v => JSON.parse(JSON.stringify(v));

  function run(op) {
    if (op.op === 'signup') {
      if (T.users.some(u => u.email === op.email)) return { error: { message: 'User already registered' } };
      const id = 'u' + Date.now().toString(36); T.users.push({ id, email: op.email, password: op.password });
      T.profiles.push({ id, code: op.meta.code, name: op.meta.name, role: 'counter', active: false }); persist();
      return { session: { access_token: 't' + id, user: { id } } };
    }
    if (op.op === 'signin') { const u = T.users.find(x => x.email === op.email && x.password === op.password); return u ? { session: { access_token: 't' + u.id, user: { id: u.id } } } : { error: { message: 'Invalid login credentials' } }; }
    if (op.op === 'rpc') {
      if (op.name === 'ams_has_users') return { data: T.profiles.length > 0, error: null };
      if (op.name === 'ams_set_pin') { const u = T.users.find(x => x.id === op.args.p_user); if (u) u.password = op.args.p_password; persist(); return { data: null, error: null }; }
      return { data: null, error: null };
    }
    const q = op.q, t = T[q.table], r = role(op.uid), match = row => q.eq.every(([f, v]) => row[f] === v);
    if (q.action === 'select') {
      let rows = t.filter(match);
      for (const f of [...q.order].reverse()) rows = [...rows].sort((a, b) => a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0);
      if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
      const cols = q.cols === '*' ? null : q.cols.split(',');
      rows = rows.map(x => cols ? Object.fromEntries(cols.map(c => [c, x[c]])) : x);
      return { data: q.single ? (clone(rows[0] || null)) : clone(rows), error: null };
    }
    if (q.action === 'upsert') {
      if (q.table === 'kv' && r !== 'lead') return { error: { message: 'new row violates row-level security policy' } };
      for (const v of q.values) {
        const key = q.table === 'kv' ? 'key' : 'id', ex = t.findIndex(x => x[key] === v[key]);
        if (ex >= 0) { if (q.opts.ignoreDuplicates) continue; t[ex] = clone(v); push({ table: q.table, eventType: 'UPDATE', new: clone(v) }); }
        else { t.push(clone(v)); push({ table: q.table, eventType: 'INSERT', new: clone(v) }); }
      }
      persist(); return { data: null, error: null };
    }
    if (q.action === 'update') { t.filter(match).forEach(x => Object.assign(x, q.values)); persist(); return { data: null, error: null }; }
    if (q.action === 'delete') {
      const gone = t.filter(match); T[q.table] = t.filter(x => !match(x));
      for (const g of gone) push({ table: q.table, eventType: 'DELETE', old: q.table === 'kv' ? { key: g.key } : { id: g.id, round: g.round } });
      persist(); return { data: null, error: null };
    }
    return { error: { message: 'unsupported' } };
  }

  function createClient(url, key, opts = {}) {
    const a = opts.auth || {}, sk = a.storageKey || 'sb';
    let mem = null;
    const getS = () => { if (a.persistSession === false) return mem; try { return JSON.parse(localStorage.getItem(sk) || 'null'); } catch { return mem; } };
    const setS = s => { if (a.persistSession === false) { mem = s; return; } try { if (s) localStorage.setItem(sk, JSON.stringify(s)); else localStorage.removeItem(sk); } catch { mem = s; } };
    const uid = () => getS()?.user?.id || null;
    const call = op => Promise.resolve(run(op));
    function builder(table) {
      const q = { table, action: 'select', cols: '*', eq: [], order: [], range: null, single: false };
      const b = {
        select(c) { q.cols = c; return b; }, eq(f, v) { q.eq.push([f, v]); return b; }, order(f) { q.order.push(f); return b; },
        range(x, y) { q.range = [x, y]; return b; }, maybeSingle() { q.single = true; return b; },
        upsert(v, o) { q.action = 'upsert'; q.values = Array.isArray(v) ? v : [v]; q.opts = o || {}; return b; },
        update(v) { q.action = 'update'; q.values = v; return b; }, delete() { q.action = 'delete'; return b; },
        then(res, rej) { return call({ op: 'query', q, uid: uid() }).then(res, rej); }
      };
      return b;
    }
    return {
      auth: {
        async getSession() { return { data: { session: getS() } }; },
        async signInWithPassword({ email, password }) { const r = run({ op: 'signin', email, password }); if (r.error) return { data: {}, error: r.error }; setS(r.session); return { data: { session: r.session }, error: null }; },
        async signUp({ email, password, options }) { const r = run({ op: 'signup', email, password, meta: options?.data || {} }); if (r.error) return { data: {}, error: r.error }; if (a.persistSession !== false) setS(r.session); else mem = r.session; return { data: { user: r.session.user, session: r.session }, error: null }; },
        async signOut() { setS(null); return { error: null }; }
      },
      from: builder,
      rpc(name, args) { return call({ op: 'rpc', name, args, uid: uid() }); },
      channel(name) { const c = { name, ls: [], on(type, f, cb) { c.ls.push({ f, cb }); return c; }, subscribe(st) { chans.push(c); setTimeout(() => st && st('SUBSCRIBED'), 5); return c; } }; return c; },
      removeChannel(c) { const i = chans.indexOf(c); if (i >= 0) chans.splice(i, 1); }
    };
  }
  window.supabase = { createClient };
})();
