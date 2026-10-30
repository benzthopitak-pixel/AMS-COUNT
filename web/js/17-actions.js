/* AssetSync · ปุ่มทุกปุ่มบนหน้าจอ (data-a=...) และช่องกรอก/เลือกไฟล์ */
function edit(code, fields) {
  pushEvent({ k: 'edit', code, round: meta.id, ...fields });
  render();
}
function save(name, data, mime) {
  if (dl)
    return dl
      .save({ filename: name, data, type: mime })
      .then(r => ['บันทึกไฟล์แล้ว: ' + name + (r?.where ? ' · ' + r.where : ''), 'ok'])
      .catch(e =>
        e?.code === 'declined' ? ['ยกเลิกการบันทึก', ''] : ['บันทึกไม่สำเร็จ (' + (e?.code || e) + ')', 'bad']
      );
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
    return Promise.resolve(['ดาวน์โหลดแล้ว: ' + name, 'ok']);
  } catch {
    return Promise.resolve(['ดาวน์โหลดไม่ได้ในหน้านี้', 'bad']);
  }
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  if (t.dataset.a.startsWith('close') && e.target.closest('[data-stop]') && e.target.closest('[data-a]') !== t) return;
  if (
    (t.dataset.a === 'closeitem' || t.dataset.a === 'closepick' || t.dataset.a === 'closesearch') &&
    t.classList.contains('sheetbg') &&
    e.target !== t
  )
    return;
  const a = t.dataset.a,
    v = t.dataset.v;
  if (/^(lbl|xls|prn)/.test(a) && (await lblAction(a, v))) return;
  switch (a) {
    case 'mode':
      S.mode = v;
      LS.set('mode', v);
      break;
    case 'web':
      S.web = v;
      S.msg = {};
      break;
    case 'app':
      S.app = v;
      if (v === 'scan' && !S.area) {
        S.app = 'area';
        S.areaPick = true;
      }
      break;
    case 'newround': {
      if (meta && meta.status !== 'closed' && !confirmNew) {
        confirmNew = true;
        flash('มีรอบที่ยังไม่ปิด กดอีกครั้งเพื่อสร้างรอบใหม่ (รอบเดิมจะถูกแทนที่)');
        return;
      }
      confirmNew = false;
      const keep = master.size ? (meta?.areas || []).map(x => ({ ...x, assignee: null })) : [];
      await saveMeta({
        id: 'r' + Date.now(),
        name: 'ตรวจนับ ' + new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
        status: 'prepare',
        createdAt: Date.now(),
        team: meta?.team || [],
        areas: keep,
        fileName: meta?.fileName || '',
        sheet: meta?.sheet || '',
        headers: meta?.headers || null,
        tpl: meta?.tpl || null,
        ver: meta?.ver,
        chunks: meta?.chunks,
        woCount: meta?.woCount || 0
      });
      loadMine();
      evRound = null;
      subscribeEvents();
      S.web = 'prepare';
      S.cards = [];
      break;
    }
    case 'pickjob':
      pickJob(v);
      S.web = S.mode === 'web' ? 'live' : S.web;
      S.app = 'home';
      break;
    case 'markas':
    case 'wmark': {
      const web = t.dataset.a === 'wmark',
        c2 = t.dataset.c,
        rm = ($('#mkRemark-' + v)?.value || '').trim();
      if (!web && !S.area) {
        flash('เลือก CC ก่อน');
        S.areaPick = true;
        break;
      }
      const area = web
        ? { code: String(t.dataset.cc), name: t.dataset.ccn || String(t.dataset.cc), shared: false }
        : S.area;
      if (c2 === 'lost') {
        pushEvent({ k: 'edit', code: v, round: meta.id, lost: true, remark: rm, area: String(area.code) });
        flash('บันทึกว่าสูญหายแล้ว');
        if (!web) S.item = null;
        break;
      }
      pushEvent({
        k: 'scan',
        code: v,
        round: meta.id,
        area: String(area.code),
        areaName: area.name,
        shared: !!area.shared,
        room: web ? '' : S.room,
        ns: true,
        src: web ? 'web' : 'manual'
      });
      if (c2 !== 'ปกติ' || rm)
        pushEvent({
          k: 'edit',
          code: v,
          round: meta.id,
          ...(c2 !== 'ปกติ' ? { cond: c2 } : {}),
          ...(rm ? { remark: rm } : {})
        });
      flash(`บันทึกว่าพบแล้ว${c2 !== 'ปกติ' ? ' · ' + c2 : ''} · ติด "ต้องพิมพ์สติกเกอร์ใหม่" ให้`);
      if (!web) {
        S.cards.unshift({ code: v });
        S.item = null;
        S.search = null;
      }
      break;
    }
    case 'theme':
      LS.set('theme', applyTheme(v));
      break;
    case 'ccsave': {
      const P = S.ccPend;
      if (!P) break;
      try {
        await ccSave({ map: P[P.col], file: P.file, col: P.col });
        S.msg.cc = [`บันทึกรายชื่อ Cost Center แล้ว ${N(Object.keys(P[P.col]).length)} รหัส`, 'ok'];
        S.ccPend = null;
      } catch (e) {
        S.msg.cc = ['บันทึกขึ้นระบบไม่สำเร็จ: ' + (e.message || e), 'bad'];
      }
      break;
    }
    case 'cccancel':
      S.ccPend = null;
      break;
    case 'ccapply': {
      S.msg.cc = ['กำลังใส่ชื่อแผนก…', 'ok'];
      render();
      try {
        const n = await ccApplyToJob();
        S.msg.cc = [n ? `ใส่ชื่อแผนกให้งาน "${meta.name}" แล้ว ${n} แผนก` : 'ไม่มีแผนกที่ต้องใส่ชื่อ', 'ok'];
      } catch (e) {
        S.msg.cc = ['ไม่สำเร็จ: ' + (e.message || e), 'bad'];
      }
      break;
    }
    case 'closesub':
      S.subPop = null;
      break;
    case 'subone':
    case 'suball': {
      const p = S.subPop;
      if (!p || !S.area || !meta) {
        S.subPop = null;
        break;
      }
      if (S.area && !S.area.shared && ccClosed(S.area.code)) {
        S.subPop = null;
        flash('CC นี้ปิดงานแล้ว · เปิดนับต่อก่อน');
        break;
      }
      const extra = { qf: 'asset', qraw: p.raw };
      S.subPop = null;
      if (a === 'subone') {
        countCode(v, p.src, extra);
        return;
      }
      const { cur } = compute(),
        todo = p.keys.filter(k => !cur.has(k));
      let firstOther = null;
      for (const k of todo)
        if (countCode(k, p.src, extra, true) && !firstOther && isOther(compute().cur.get(k))) firstOther = k;
      beep(firstOther ? 'oth' : 'ok');
      if (firstOther) S.othPop = { code: firstOther, also: todo.filter(k => isOther(compute().cur.get(k))) };
      flash(`นับแล้ว ${todo.length} รายการ (Asset ${p.base})`);
      break;
    }
    case 'unlost':
      pushEvent({ k: 'edit', code: v, round: meta.id, lost: false });
      flash('กลับเป็นรอตรวจแล้ว');
      break;
    case 'reptab':
      S.repTab = v;
      S.msg.rep = null;
      break;
    case 'navgrp': {
      const o = LS.get('navOpen', {});
      o[v] = !(o[v] ?? false);
      LS.set('navOpen', o);
      break;
    }
    case 'gopivot':
      S.web = 'pivot';
      S.repTab = 'pv';
      break;
    case 'exprep':
      S.msg.exp = ['กำลังสร้างไฟล์…', 'ok'];
      render();
      try {
        S.msg.exp = await reportFile(t.dataset.k, v);
      } catch (e) {
        S.msg.exp = ['สร้างไฟล์ไม่สำเร็จ: ' + e.message, 'bad'];
      }
      break;
    case 'pvreset':
      LS.set('pv-' + meta.id, null);
      {
        const b = $('#pivotBox');
        if (b) delete b.dataset.ready;
      }
      break;
    case 'crcol': {
      const C = crConf();
      C.cols = C.cols.includes(v) ? C.cols.filter(x => x !== v) : [...C.cols, v];
      LS.set('cr-' + meta.id, C);
      break;
    }
    case 'repdl':
      S.msg.rep = ['กำลังสร้างไฟล์…', 'ok'];
      render();
      try {
        S.msg.rep = await reportFile(!S.repTab || S.repTab === 'dash' ? 'sum' : S.repTab, v);
      } catch (e) {
        S.msg.rep = ['สร้างไฟล์ไม่สำเร็จ: ' + e.message, 'bad'];
      }
      break;
    case 'askbulk':
      S.confirmBulk = v;
      break;
    case 'nobulk':
      S.confirmBulk = null;
      break;
    case 'bulkqr': {
      const list = (S.bulkQR || []).slice();
      for (const c of list) pushEvent({ k: 'edit', code: c, round: meta.id, hasQR: true });
      S.confirmBulk = null;
      flash(`ยืนยันว่ามี QR แล้ว ${list.length} รายการ`);
      break;
    }
    case 'setqr':
      pushEvent({ k: 'edit', code: v, round: meta.id, hasQR: t.dataset.x === '1' });
      flash(t.dataset.x === '1' ? 'บันทึกแล้ว: มีสติกเกอร์ QR' : 'บันทึกแล้ว: ยังไม่มีสติกเกอร์ QR');
      break;
    case 'bulkmove': {
      const list = pendingMoves(v);
      for (const s2 of list) pushEvent({ k: 'rv', act: 'approve_move', code: s2.code, round: meta.id });
      S.confirmBulk = null;
      flash(`อนุมัติย้าย ${list.length} รายการ · รอโอนย้ายใน SAP`);
      break;
    }
    case 'dupdrop':
      pushEvent({ k: 'edit', code: v, round: meta.id, dropScan: t.dataset.id });
      flash('ลบรายการซ้ำแล้ว');
      break;
    case 'dupdropall': {
      const l = myDups();
      for (const d of l) pushEvent({ k: 'edit', code: d.code, round: meta.id, dropScan: d.id });
      S.dupSyncHide = 0;
      flash(`ลบรายการซ้ำ ${l.length} รายการแล้ว`);
      break;
    }
    case 'duplater':
      S.dupSyncHide = myDups().length;
      break;
    case 'dupuse':
      edit(v, { area: String(t.dataset.cc), areaName: t.dataset.ccn });
      pushEvent({ k: 'rv', act: 'dup_ack', code: v, round: meta.id });
      flash('เปลี่ยนที่พบแล้ว');
      return;
    case 'askclose':
      S.confirmClose = v;
      break;
    case 'noclose':
      S.confirmClose = null;
      break;
    case 'ccclose':
      S.confirmClose = null;
      pushEvent({ k: 'edit', code: '#CC:' + v, round: meta.id, areaDone: true, left: +t.dataset.n || 0 });
      beep('ok');
      flash('ปิดงาน CC เรียบร้อยแล้ว');
      break;
    case 'ccreopen':
      pushEvent({ k: 'edit', code: '#CC:' + v, round: meta.id, areaDone: false });
      flash('เปิดนับต่อแล้ว');
      break;
    case 'askdel':
      S.confirmDel = v;
      break;
    case 'nodel':
      S.confirmDel = null;
      break;
    case 'deljob':
      S.confirmDel = null;
      await deleteJob(v);
      return;
    case 'askreset':
      S.confirmReset = true;
      break;
    case 'noreset':
      S.confirmReset = false;
      break;
    case 'reset':
      S.confirmReset = false;
      if (meta) {
        LS.set('mine-' + meta.id, []);
        if (db)
          try {
            await Store.db.deleteRound(meta.id);
          } catch (e) {
            flash('ลบผลนับบนระบบไม่สำเร็จ: ' + e.message);
            return;
          }
      }
      await saveMeta(null);
      mine = [];
      serverEv = {};
      S.cards = [];
      S.web = 'rounds';
      flash('ลบรอบแล้ว');
      return;
    case 'doimport':
      await doImport();
      return;
    case 'cancelimport':
      S.imp = null;
      break;
    case 'adduser': {
      const n = $('#newUser').value.trim();
      if (!n) return;
      const team = [...(meta.team || [])];
      if (!team.some(u => u.name === n)) team.push({ name: n, role: $('#newRole').value });
      await saveMeta({ ...meta, team });
      return;
    }
    case 'addarea': {
      const n = $('#newArea').value.trim();
      if (!n) return;
      const areas = [
        ...(meta.areas || []),
        { code: 'S' + Date.now().toString(36), name: n, count: 0, assignee: null, shared: true }
      ];
      await saveMeta({ ...meta, areas });
      return;
    }
    case 'release':
      await saveMeta({ ...meta, status: 'counting', releasedAt: Date.now() });
      S.web = 'live';
      flash('ปล่อยงานแล้ว · เปิดแท็บ "เครื่องสแกน (แอป)" เพื่อเริ่มนับ');
      return;
    case 'livearea':
      S.liveArea = S.liveArea === v ? null : v;
      break;
    case 'opencc':
      S.web = 'cc';
      S.ccSel = String(v);
      S.ccTab = t.dataset.t || 'all';
      S.ccPick = null;
      S.ccItemQ = '';
      S.confirmUndo = null;
      break;
    case 'cctab':
      S.ccTab = v;
      S.ccPick = null;
      break;
    case 'ccpick':
      S.resetRight = S.ccPick !== v;
      S.ccPick = v;
      S.confirmUndo = null;
      break;
    case 'openitemcc': {
      const a2 = master.get(v),
        s2 = compute().cur.get(v);
      S.web = 'cc';
      S.ccSel = String(a2 ? a2.cc : s2?.area || '*');
      S.ccTab = 'all';
      S.ccItemQ = '';
      S.ccPick = v;
      break;
    }
    case 'wcond':
      edit(v, { cond: t.dataset.c });
      return;
    case 'wremark':
      edit(v, { remark: ($('#wRemark')?.value || '').trim() });
      flash('บันทึก Remark แล้ว');
      return;
    case 'askundo':
      S.confirmUndo = v;
      break;
    case 'editpop':
      S.editPop = v;
      S.editF = { what: null };
      break;
    case 'closeedit':
      S.editPop = null;
      break;
    case 'editwhat':
      S.editF = { what: v };
      break;
    case 'edset':
      edit(v, { [t.dataset.f]: t.dataset.c });
      flash('แก้ไขแล้ว');
      return;
    case 'edsave': {
      const f = t.dataset.f;
      if (f === 'area') {
        const ar = (meta.areas || []).find(x => String(x.code) === $('#edArea').value);
        if (ar) edit(v, { area: String(ar.code), areaName: ar.name });
      } else edit(v, { [f]: ($(f === 'remark' ? '#edRemark' : '#edRoom')?.value || '').trim() });
      S.editPop = null;
      flash('บันทึกแล้ว');
      render();
      return;
    }
    case 'noundo':
      S.confirmUndo = null;
      break;
    case 'wundo':
      pushEvent({ k: 'del', code: v, round: meta.id });
      S.confirmUndo = null;
      flash('ยกเลิกผลนับแล้ว · กลับเป็นรอตรวจ');
      break;
    case 'wfound':
      pushEvent({
        k: 'scan',
        code: v,
        round: meta.id,
        area: String(t.dataset.cc),
        areaName: t.dataset.ccn || String(t.dataset.cc),
        shared: false,
        room: '',
        ns: true,
        src: 'web'
      });
      flash('บันทึกว่าพบแล้ว · ติด "ต้องพิมพ์สติกเกอร์ใหม่" ให้แล้ว');
      break;
    case 'inboxtab':
      S.web = 'inbox';
      S.inboxTab = v;
      S.inboxSel = null;
      S.inboxChecked.clear();
      break;
    case 'inboxsel':
      S.inboxSel = v;
      break;
    case 'openinbox':
      S.web = 'inbox';
      {
        const s = compute().cur.get(v),
          c = cats();
        S.inboxTab = Object.keys(c).find(k => c[k].some(x => x.code === v)) || 'cleared';
        S.inboxSel = v;
      }
      break;
    case 'check':
      t.checked ? S.inboxChecked.add(v) : S.inboxChecked.delete(v);
      render();
      return;
    case 'bulkapprove':
      for (const code of S.inboxChecked) pushEvent({ k: 'rv', act: 'approve_move', code, round: meta.id });
      flash(`อนุมัติย้าย ${S.inboxChecked.size} รายการ`);
      S.inboxChecked.clear();
      break;
    case 'rv':
      pushEvent({ k: 'rv', act: t.dataset.act, code: v, round: meta.id });
      flash('บันทึกแล้ว');
      break;
    case 'leadflag':
    case 'appflag': {
      const s = compute().cur.get(v);
      if (!s) return;
      const f = t.dataset.f;
      edit(v, { flags: { [f]: !s.flags[f] } });
      return;
    }
    case 'leftchoice':
      S.closeChoice = t.value;
      return;
    case 'closeround':
      await saveMeta({ ...meta, status: 'closed', closedAt: Date.now(), leftChoice: S.closeChoice });
      flash('ปิดรอบแล้ว');
      return;
    case 'reopen':
      await saveMeta({ ...meta, status: 'counting', closedAt: null });
      return;
    case 'export':
      S.msg.exp = await exportFile(v);
      break;
    case 'sttab':
      S.stTab = v;
      break;
    case 'stsel':
      t.checked ? S.stSel.add(v) : S.stSel.delete(v);
      render();
      return;
    case 'stall': {
      const list = stickerList(cats());
      if (t.checked) list.forEach(x => S.stSel.add(x));
      else S.stSel.clear();
      render();
      return;
    }
    case 'stpdf':
      S.msg.st = await stickerPdf(v === 'test');
      break;
    case 'stprint':
      S.msg.st = await stickerPrint(v === 'test');
      break;
    case 'stxlsx':
      S.msg.st = await stickerExcel([...S.stSel]);
      break;
    case 'stdone':
      for (const code of S.stSel) {
        if (compute().cur.has(code)) pushEvent({ k: 'edit', code, round: meta.id, printed: true });
      }
      S.msg.st = [`บันทึกว่าติดแล้ว ${S.stSel.size} ดวง`, 'ok'];
      S.stSel.clear();
      break;
    case 'login':
      S.user = meta.team[+v];
      LS.set('user', S.user);
      break;
    case 'loginname': {
      const n = $('#loginName').value.trim();
      if (!n) return;
      S.user = { name: n, role: 'counter' };
      LS.set('user', S.user);
      if (meta) {
        const team = [...(meta.team || [])];
        if (!team.some(u => u.name === n)) {
          team.push(S.user);
          await saveMeta({ ...meta, team });
        }
      }
      break;
    }
    case 'logout':
      S.user = null;
      LS.set('user', null);
      S.app = 'home';
      if (!usbMode) {
        unsubMeta?.();
        unsubMeta = null;
        unsubEv?.();
        unsubEv = null;
        evRound = null;
        db = null;
        S.authed = false;
        serverEv = {};
        await Store.auth.logout();
        S.gate = 'login';
      }
      break;
    case 'dologin':
      await doLogin();
      return;
    case 'firstlead':
      await doFirstLead();
      return;
    case 'savecfg': {
      const u = $('#cfgUrl').value.trim(),
        k = $('#cfgKey').value.trim();
      if (!/^https:\/\/.+/.test(u) || k.length < 20) {
        S.gateMsg = 'ใส่ Project URL (https://…supabase.co) และ anon key ให้ครบ';
        break;
      }
      Store.auth.setConfig(u, k);
      S.gateMsg = null;
      S.gate = 'boot';
      render();
      await connect();
      return;
    }
    case 'editcfg':
      S.gate = 'setup';
      break;
    case 'cancelcfg':
      S.gateMsg = null;
      S.gate = S.authed ? null : 'login';
      break;
    case 'addmember':
      await addMember();
      return;
    case 'editname':
      S.editName = v;
      break;
    case 'noname':
      S.editName = null;
      break;
    case 'memname': {
      const n = ($('#nm-' + v)?.value || '').trim();
      if (!n) {
        flash('ใส่ชื่อก่อน');
        return;
      }
      S.editName = null;
      await teamOp(() => Store.auth.updateMember(v, { name: n }), 'แก้ชื่อแล้ว');
      return;
    }
    case 'askmemdel':
      S.confirmMem = v;
      break;
    case 'nomemdel':
      S.confirmMem = null;
      break;
    case 'memdel': {
      S.confirmMem = null;
      const u = S.team.find(x => x.id === v);
      await teamOp(() => Store.auth.deleteMember(v), `ลบ ${u?.name || ''} แล้ว · ผลนับที่เคยส่งยังอยู่`);
      return;
    }
    case 'memrole': {
      const u = S.team.find(x => x.id === v);
      if (!u) return;
      await teamOp(
        () => Store.auth.updateMember(v, { role: u.role === 'lead' ? 'counter' : 'lead' }),
        'เปลี่ยนบทบาทแล้ว'
      );
      return;
    }
    case 'memactive': {
      const u = S.team.find(x => x.id === v);
      if (!u) return;
      if (u.id === S.user?.id) {
        flash('ปิดใช้บัญชีตัวเองไม่ได้');
        return;
      }
      await teamOp(() => Store.auth.updateMember(v, { active: !u.active }), u.active ? 'ปิดใช้แล้ว' : 'เปิดใช้แล้ว');
      return;
    }
    case 'mempin': {
      const pin = ($('#pin-' + v)?.value || '').trim();
      const u = S.team.find(x => x.id === v);
      if (!/^\d{4,8}$/.test(pin)) {
        flash('PIN ต้องเป็นตัวเลข 4–8 หลัก');
        return;
      }
      await teamOp(() => Store.auth.setPin(v, u.code, pin), `ตั้ง PIN ใหม่ให้ ${u.name} แล้ว`);
      return;
    }
    case 'areapick':
      S.areaPick = true;
      break;
    case 'closepick':
      S.areaPick = false;
      break;
    case 'setarea': {
      setTimeout(startPresence, 0);
      S.areaQ = '';
      const ar = (meta.areas || []).find(x => String(x.code) === v);
      S.area = { code: String(ar.code), name: ar.name, shared: !!ar.shared };
      LS.set('area', S.area);
      S.areaPick = false;
      S.app = 'area';
      S.areaTab = 'left';
      break;
    }
    case 'areatab':
      S.areaTab = v;
      break;
    case 'openitem':
      S.item = v;
      break;
    case 'closeitem':
      S.item = null;
      break;
    case 'dec':
      edit(v, { dec: t.dataset.d });
      return;
    case 'uname':
      edit(v, { uname: $('#un-' + CSS.escape(v)).value.trim() });
      flash('บันทึกชื่อแล้ว');
      return;
    case 'undo':
      pushEvent({ k: 'del', code: v, round: meta.id });
      S.item = null;
      flash('ยกเลิกผลนับแล้ว');
      break;
    case 'cond':
      edit(v, { cond: t.dataset.c });
      return;
    case 'remark':
      edit(v, { remark: $('#remarkIn').value.trim() });
      flash('บันทึก Remark แล้ว');
      return;
    case 'markfound':
      if (!S.area) {
        flash('เลือกแผนกก่อน');
        S.areaPick = true;
        break;
      }
      pushEvent({
        k: 'scan',
        code: v,
        round: meta.id,
        area: String(S.area.code),
        areaName: S.area.name,
        shared: !!S.area.shared,
        room: S.room,
        ns: true,
        src: 'manual'
      });
      S.cards.unshift({ code: v });
      S.item = null;
      S.search = null;
      S.app = 'scan';
      flash('บันทึกว่าพบแล้ว · ติด "ต้องพิมพ์สติกเกอร์ใหม่" ให้แล้ว');
      break;
    case 'opensearch':
      S.search = { q: '', all: false };
      break;
    case 'closesearch':
      S.search = null;
      break;
    case 'srchall':
      S.search.all = v === '1';
      break;
    case 'srchsave': {
      const q = S.search.q.trim();
      if (!q) return;
      S.search = null;
      S.manual = true;
      doScan(q);
      S.manual = false;
      return;
    }
    case 'closedup':
      clearTimeout(S.dupT);
      S.dupPop = null;
      break;
    case 'closeoth':
      S.othPop = null;
      break;
    case 'ccfclear':
      S.ccF = {};
      break;
    case 'openrc':
      if (window.AndroidBridge.openReaderConfig() !== 'OK')
        flash('ไม่พบแอป ReaderConfig · เปิดจากหน้ารวมแอปของเครื่อง');
      return;
    case 'appinfo':
      window.AndroidBridge.openAppInfo(v);
      return;
    case 'chkupd':
      flash('กำลังตรวจหาอัปเดต…');
      window.AndroidBridge.checkUpdate();
      return;
    case 'applyupd':
      flush().finally(() => (window.AndroidBridge?.reload ? window.AndroidBridge.reload() : location.reload()));
      return;
    case 'popdec':
      for (const c2 of S.othPop?.also || [v]) edit(c2, { dec: t.dataset.d });
      S.othPop = null;
      render();
      return; // "พบทั้งหมด": one answer for every Sub counted here
    case 'manual':
      S.manual = !S.manual;
      break;
    case 'feedf':
      S.feedF = v;
      break;
    case 'verify':
      await verify();
      break;
    case 'syncinfo':
      flash(syncInfo()[1]);
      return;
    case 'pick': {
      const g = $('#gFile'),
        o = PICK[v];
      pickFor = v;
      g.accept = o[0];
      g.multiple = o[1];
      g.value = '';
      g.click();
      return;
    }
    case 'usbmode': {
      const on = v === '1';
      if (on === usbMode) return;
      usbMode = on;
      LS.set('usbMode', on);
      S.msg.usbApp = null;
      if (on) {
        unsubMeta?.();
        unsubMeta = null;
        unsubEv?.();
        unsubEv = null;
        evRound = null;
        db = null;
        S.authed = false;
        serverEv = {};
        S.gate = null;
        if (!S.user) S.user = null;
      } else {
        S.user = null;
        S.gate = 'boot';
        render();
        await connect();
      }
      _cache = null;
      break;
    }
    case 'usbpkg':
      S.msg.pkg = await exportPackage();
      break;
    case 'usbreport':
      S.msg.usbApp = await exportReport();
      break;
  }
  render();
});
let confirmNew = false,
  pickFor = null;
const PICK = {
  master: ['.xlsx,.xls,.csv', false],
  cc: ['.xlsx,.xls,.csv', false],
  pkg: ['.json,application/json', false],
  usb: ['.xlsx', true]
};
async function onMasterFile(f) {
  const buf = await f.arrayBuffer();
  try {
    const book = XLSX.read(buf, { type: 'array', sheetRows: 15 }),
      hidden = new Set((book.Workbook?.Sheets || []).filter(x => x.Hidden).map(x => x.name));
    let best = book.SheetNames.find(n => !hidden.has(n)) || book.SheetNames[0],
      score = 0;
    for (const n of book.SheetNames) {
      if (hidden.has(n)) continue;
      const rows = XLSX.utils.sheet_to_json(book.Sheets[n], { header: 1, defval: '' }),
        hr = rows.find(r => r.some(c => norm(c) === 'ASSET')),
        sc = hr ? hr.filter(c => String(c).trim()).length : 0;
      if (sc > score) {
        score = sc;
        best = n;
      }
    }
    S.imp = { buf, fileName: f.name, names: book.SheetNames, hidden };
    prepareImport(best);
  } catch (err) {
    S.imp = { buf, fileName: f.name, names: [], hidden: new Set(), err: 'อ่านไฟล์ไม่ได้: ' + err.message };
  }
}
async function onFiles(why, files) {
  if (!files.length) return;
  if (why === 'master') {
    await onMasterFile(files[0]);
    S.web = 'rounds';
    if (S.imp && !S.imp.roundName)
      S.imp.roundName =
        'ตรวจนับ ' + new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (why === 'cc') {
    S.msg.cc = null;
    try {
      const r = await ccReadFile(files[0]);
      if (r) S.ccPend = { ...r, col: r.name && Object.keys(r.name).length ? 'name' : 'desc' };
      else S.msg.cc = ['ไม่พบคอลัมน์ Cost Center + Name / DESCRIPTION ในไฟล์นี้', 'bad'];
    } catch (e) {
      S.msg.cc = ['อ่านไฟล์ไม่ได้: ' + e.message, 'bad'];
    }
  }
  if (why === 'pkg') {
    S.msg.usbApp = await importPackage(files[0]);
    S.app = 'me';
  }
  if (why === 'usb') {
    flash('กำลังอ่านไฟล์…');
    await importReports(files);
  }
  render();
}
// file inputs live outside the re-rendered UI, so a live update can't swap them out while the picker is open
document.addEventListener('dragover', e => {
  if (e.target.closest?.('[data-drop]')) e.preventDefault();
});
document.addEventListener('drop', e => {
  const z = e.target.closest?.('[data-drop]');
  if (!z) return;
  e.preventDefault();
  onFiles(z.dataset.drop, [...(e.dataTransfer?.files || [])]);
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'gFile' && t.files.length) {
    const files = [...t.files],
      why = pickFor;
    pickFor = null;
    t.value = '';
    await onFiles(why, files);
  }
  if (t.id === 'ccCol' && S.ccPend) {
    S.ccPend.col = t.value;
    render();
  }
  if (t.id === 'impSheet') {
    prepareImport(t.value.replace(/ \(ซ่อน\)$/, ''));
    render();
  }
  if (t.dataset.map) {
    S.imp.map[t.dataset.map] = +t.value;
    render();
  }
  if (t.dataset.assign !== undefined) {
    const areas = [...meta.areas];
    areas[+t.dataset.assign] = { ...areas[+t.dataset.assign], assignee: t.value || null };
    await saveMeta({ ...meta, areas });
  }
  if (t.id === 'roomIn') {
    S.room = t.value.trim();
    LS.set('room', S.room);
  }
  if (t.id === 'stSize') {
    S.stSize = t.value;
    LS.set('stSize', t.value);
    setTimeout(render);
  }
  if (t.id === 'impRound' && S.imp) S.imp.roundName = t.value;
  if (t.id === 'ccSort') {
    S.ccSort = t.value;
    render();
  }
  if (t.id === 'jobSel') {
    pickJob(t.value);
    render();
  }
  if (t.id === 'repCC') {
    S.repCC = t.value;
    render();
  }
  if (t.id === 'ccPickSel' && t.value) {
    S.web = 'cc';
    S.ccSel = t.value;
    S.ccTab = 'all';
    S.ccPick = null;
    S.ccItemQ = '';
    render();
  }
  if (t.dataset.cr) {
    const C = crConf();
    C[t.dataset.cr] = t.value;
    LS.set('cr-' + meta.id, C);
    render();
  }
  if (t.dataset.ccf) {
    S.ccF = { ...(S.ccF || {}), [t.dataset.ccf]: t.value };
    render();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'areaQ') {
    S.areaQ = e.target.value;
    clearTimeout(window._aq);
    window._aq = setTimeout(() => {
      render();
      const i = $('#areaQ');
      if (i) {
        i.focus({ preventScroll: true });
        i.setSelectionRange(i.value.length, i.value.length);
      }
    }, 200);
    return;
  }
  if (e.target.id === 'ccQ' || e.target.id === 'ccItemQ' || e.target.id === 'ccnQ') {
    S[e.target.id] = e.target.value;
    clearTimeout(window._cq);
    window._cq = setTimeout(render, 200);
    return;
  }
  if (e.target.id === 'srchIn' && S.search) {
    S.search.q = e.target.value;
    clearTimeout(window._sq);
    window._sq = setTimeout(render, 150);
    return;
  }
  if (e.target.id === 'stPaste') {
    S.stPaste = e.target.value;
    clearTimeout(window._sp);
    window._sp = setTimeout(render, 400);
  }
});
document.addEventListener('submit', e => {
  if (e.target.id === 'loginForm') {
    e.preventDefault();
    doLogin();
    return;
  }
  if (e.target.id === 'scanForm') {
    e.preventDefault();
    const i = $('#scanIn');
    const v = i.value;
    i.value = '';
    doScan(v);
    setTimeout(() => $('#scanIn')?.focus({ preventScroll: true }), 0);
  }
});
