(function () {
  const $ = s => document.querySelector(s);
  const run = fn => async () => { try { await fn(); } catch (err) { toast(err.message); } };
  const $$ = s => [...document.querySelectorAll(s)];
  if (!api.token()) { location.replace("/login.html"); return; }

  // оқу тілдері — өз атауларымен (аударылмайды)
  const LANGS = { kk: "Қазақша", ru: "Русский", en: "English" };
  const STATUS_CHIP = { empty: "empty", up: "up", review: "review", ok: "ok", bad: "bad" };

  let C = null, programs = [], deadlines = [], faqs = [];
  let homeFilter = 'all', catalogFilter = 'all';
  const copy = (kk, ru) => lang() === 'ru' ? ru : kk;
  function cabinetLabels() {
    $$('[data-kk]').forEach(el => el.textContent = lang() === 'ru' ? el.dataset.ru : el.dataset.kk);
    $$('[data-placeholder-kk]').forEach(el => el.placeholder = lang() === 'ru' ? el.dataset.placeholderRu : el.dataset.placeholderKk);
  }
  const fields = {
    1: { group:'it', symbol:'IS', tags:['Дерекқор|Базы данных', 'Веб-қосымшалар|Веб-приложения', 'Жүйелік талдау|Системный анализ'] },
    2: { group:'it', symbol:'CS', tags:['Бағдарламалау|Программирование', 'Алгоритмдер|Алгоритмы', 'Жасанды интеллект|Искусственный интеллект'] },
    3: { group:'it', symbol:'CE', tags:['Компьютерлік желілер|Компьютерные сети', 'Аппараттық жүйелер|Аппаратные системы'] },
    4: { group:'business', symbol:'EC', tags:['Қаржы|Финансы', 'Экономикалық талдау|Экономический анализ'] },
    5: { group:'law', symbol:'LW', tags:['Азаматтық құқық|Гражданское право', 'Құқықтық практика|Юридическая практика'] },
    6: { group:'medicine', symbol:'MD', tags:['Жалпы медицина|Общая медицина', 'Клиникалық практика|Клиническая практика'] }
  };
  const descriptionsRu = {
    1:'Проектирование информационных систем, работа с базами данных и создание корпоративных приложений.',
    2:'Алгоритмы, программирование и основы искусственного интеллекта. Изучайте, как создавать цифровые решения.',
    3:'Компьютерные сети, аппаратное обеспечение и встроенные системы. Разбирайтесь в устройстве современных технологий.',
    4:'Микро- и макроэкономика, финансы и аналитика. Учитесь понимать экономические процессы и работать с данными.',
    5:'Право Республики Казахстан, гражданское и уголовное судопроизводство. Изучайте основы юридической практики.',
    6:'Общая медицина и основы клинической практики. Знакомьтесь с направлением подготовки в сфере здравоохранения.'
  };
  const groups = () => [['all',copy('Барлығы','Все направления')],['it','IT'],['business',copy('Экономика','Экономика')],['law',copy('Құқық','Право')],['medicine',copy('Медицина','Медицина')]];
  const description = p => lang() === 'ru' ? (descriptionsRu[p.id] || p.description) : p.description;

  const parse = iso => new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : iso + "Z");
  const fmt = iso => {
    const d = parse(iso), loc = lang() === "ru" ? "ru-RU" : "kk-KZ";
    return d.toLocaleDateString(loc, { day: "numeric", month: "short" }) + ", " +
      d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };
  const need = () => C.documents.filter(d => d.status === "empty" || d.status === "bad");
  const stage = () => {
    const st = C.application.status;
    if (st === "accepted" || st === "rejected") return 5;
    if (st === "exam") return 4;
    if (!C.application.submitted) return 1;
    if (need().length) return 2;
    return 3;
  };
  const pname = p => lang() === "ru" ? p.name_ru : p.name_kk;
  const stLabel = s => { const k = "s." + s; const v = tr(k); return v === k ? s : v; };

  async function load() {
    C = await api.get("/api/cabinet");
    programs = await api.get("/api/programs");
    deadlines = await api.get("/api/deadlines");
    faqs = await api.get("/api/faq");
    renderAll();
    route();
  }

  function home() {
    const u = C.user, cur = stage(), n = need(), a = C.application;
    $("#who").textContent = tr("c.hello", { n: u.name });
    const heads = ["", tr("c.h1"), tr("c.h2"), tr("c.h3"), tr("c.h4"), tr("c.h5")];
    $("#headline").textContent = heads[cur] || heads[3];
    const pr = programs.find(x => x.id === (a.draft || {}).program_id);
    $("#prog").textContent = a.submitted
      ? tr("c.progSent", { p: pr ? pname(pr) : (dyn(a.draft.program) || "—"), num: a.number, st: stLabel(a.status) })
      : tr("c.progNone");
    const el = $("#next");
    if (cur === 1) {
      el.className = "next";
      el.innerHTML = `<div><h2>${tr("c.n1t")}</h2><p>${tr("c.n1d")}</p></div><a class="btn" href="#programs">${copy("Мамандық таңдау","Выбрать специальность")}</a>`;
    } else if (cur === 2) {
      el.className = "next";
      el.innerHTML = `<div><h2>${tr("c.n2t", { n: n.length })}</h2><p>${tr("c.n2d", { x: esc(dyn(n[0].name)) })}</p></div><a class="btn" href="#docs">${tr("c.n2b")}</a>`;
    } else if (a.status === "accepted") {
      el.className = "next ok";
      el.innerHTML = `<div><h2>${tr("c.nOkT")}</h2><p>${tr("c.nOkD")}</p></div>`;
    } else if (a.status === "rejected") {
      el.className = "next";
      el.innerHTML = `<div><h2>${tr("c.nNoT")}</h2><p>${tr("c.nNoD")}</p></div><a class="btn" href="#help">${tr("nav.help")}</a>`;
    } else {
      el.className = "next ok";
      el.innerHTML = `<div><h2>${tr("c.nWaitT")}</h2><p>${tr("c.nWaitD")}</p></div>`;
    }
    const phase = !a.submitted ? 0 : need().length ? 1 : ['accepted','rejected'].includes(a.status) ? 3 : 2;
    const journey = [
      [copy('Мамандық таңдау','Выбор специальности'),copy('Бағытыңызды анықтаңыз','Найдите своё направление'),'programs'],
      [copy('Өтініш пен құжаттар','Заявление и документы'),copy('Деректерді толтырыңыз','Заполните данные'),'application'],
      [copy('Комиссия тексеруі','Проверка комиссии'),copy('Мәртебені бақылаңыз','Следите за статусом'),'docs'],
      [copy('Қабылдау шешімі','Решение о зачислении'),copy('Жауапты кабинеттен алыңыз','Получите ответ в кабинете'),'application']
    ];
    $("#journey").innerHTML = journey.map(([title, desc, view],i) => `<li class="${i<phase?'complete':i===phase?'current':''}"><a href="#${view}" ${i===phase?'aria-current="step"':''}><span class="journey-number">${i<phase?'✓':String(i+1).padStart(2,'0')}</span><span><strong>${title}</strong><small>${desc}</small></span></a></li>`).join('');
    const done = C.documents.filter(d => d.status === "ok" || d.status === "review").length;
    $("#hCount").textContent = copy("Құжаттар: ","Документы: ") + `${done} / ${C.documents.length}`;
    $("#hBar").style.width = Math.round(done / Math.max(C.documents.length, 1) * 100) + "%";
    const L = lang();
    $("#dates").innerHTML = deadlines.map(d => `<li><b>${esc(dyn(d.day))}</b><span>${esc(L === "ru" ? d.title_ru : d.title_kk)}</span></li>`).join("");
    $("#noteList").innerHTML = C.notes.slice(0, 3).map(n => `<li>${esc(dyn(n.t))}<small>${fmt(n.d)}</small></li>`).join("") || `<li class="empty">${tr("c.noNotes")}</li>`;
  }

  function application() {
    const a = C.application, d = a.draft || {}, b = $("#appBox");
    if (a.submitted) {
      const pr = programs.find(x => x.id === d.program_id);
      b.innerHTML = `<h2>${tr("a.sent")}</h2>
        <dl class="sum">
          <dt>${tr("a.num")}</dt><dd>${esc(a.number)}</dd>
          <dt>${tr("a.status")}</dt><dd><span class="chip ${esc(a.status)}">${esc(stLabel(a.status))}</span></dd>
          <dt>${tr("a.prog")}</dt><dd>${esc(pr ? pname(pr) : dyn(d.program))}</dd>
          <dt>${tr("a.lang")}</dt><dd>${esc(LANGS[d.lang] || d.lang)}</dd>
          <dt>${tr("a.ent")}</dt><dd>${esc(d.ent)}</dd>
          <dt>${tr("a.dorm")}</dt><dd>${d.dorm ? tr("a.dormYes") : tr("a.dormNo")}</dd>
        </dl>
        <div class="actions">
          <a class="btn" href="#docs">${tr("a.toDocs")}</a>
          ${a.status === "accepted" || a.status === "rejected" ? "" : `<button class="btn ghost" id="reopen" type="button">${tr("a.edit")}</button>`}
        </div>`;
      const r = $("#reopen");
      if (r) r.onclick = run(async () => { await api.post("/api/application/reopen", {}); await load(); toast(tr("a.reopened")); });
      return;
    }
    b.innerHTML = `<h2>${tr("a.fill")}</h2>
      <form class="form" id="appForm" novalidate>
        <label for="a-prog">${tr("a.prog")}</label>
        <select id="a-prog"><option value="">${tr("a.choose")}</option>${programs.map(p => `<option value="${p.id}" ${String(d.program_id) === String(p.id) ? "selected" : ""}>${esc(pname(p))} · ${tr("chip.ent")} ${p.min_ent}</option>`).join("")}</select>
        <div class="e err" id="ea-prog"></div>
        <div class="two">
          <div><label for="a-lang">${tr("a.lang")}</label>
            <select id="a-lang">${Object.entries(LANGS).map(([v, l]) => `<option value="${v}" ${d.lang === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
          <div><label for="a-ent">${tr("a.entLbl")}</label>
            <input id="a-ent" type="number" min="0" max="140" value="${esc(d.ent ?? "")}">
            <div class="err" id="ea-ent"></div>
          </div>
        </div>
        <label class="chk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="a-dorm" ${d.dorm ? "checked" : ""}> ${tr("a.needDorm")}</label>
        <div class="actions">
          <button class="btn" type="submit">${tr("a.submit")}</button>
          <button class="btn ghost" type="button" id="draft">${tr("a.saveDraft")}</button>
        </div>
      </form>`;
    const read = () => ({
      program_id: Number($("#a-prog").value) || null,
      lang: $("#a-lang").value,
      ent_score: $("#a-ent").value === "" ? null : Number($("#a-ent").value),
      dorm: $("#a-dorm").checked
    });
    $("#draft").onclick = async () => {
      try { await api.put("/api/application", read()); toast(tr("a.draftSaved")); await load(); }
      catch (err) { toast(err.message); }
    };
    $("#appForm").onsubmit = async e => {
      e.preventDefault();
      const v = read();
      let ok = true;
      $("#ea-prog").textContent = v.program_id ? "" : (ok = false, tr("a.errProg"));
      $("#ea-ent").textContent = (v.ent_score != null && v.ent_score >= 0 && v.ent_score <= 140) ? "" : (ok = false, tr("a.errEnt"));
      if (!ok) return;
      const p = programs.find(x => x.id === v.program_id);
      if (p && v.ent_score < p.min_ent) {
        if (!confirm(tr("a.confirmMin", { m: p.min_ent }))) return;
      }
      try {
        await api.post("/api/application/submit", v);
        toast(tr("a.sent"));
        await load();
        location.hash = "#docs";
      } catch (err) { toast(err.message); }
    };
  }

  function docs() {
    const done = C.documents.filter(d => d.status === "ok" || d.status === "review").length;
    const pct = Math.round(done / Math.max(C.documents.length, 1) * 100);
    $("#docCount").textContent = tr("d.uploaded", { a: done, b: C.documents.length });
    $("#barFill").style.width = pct + "%";
    $("#bar").setAttribute("aria-valuenow", pct);
    $("#bar").setAttribute("aria-valuemin", 0);
    $("#bar").setAttribute("aria-valuemax", 100);
    const o = { bad: 0, empty: 1, up: 2, review: 3, ok: 4 };
    $("#docList").innerHTML = [...C.documents].sort((a, b) => o[a.status] - o[b.status]).map(d => {
      const t = tr("ds." + d.status), c = STATUS_CHIP[d.status] || "empty";
      const btn = d.status === "empty" ? tr("d.upload") : d.status === "bad" ? tr("d.reupload") : (d.status === "ok" || d.status === "review") ? tr("d.replace") : "";
      return `<li data-id="${d.id}">
        <div><span class="dname">${esc(dyn(d.name))}</span><br>
        <span class="chip ${c}">${d.status === "ok" ? "✔ " : d.status === "bad" ? "✖ " : ""}${t}</span>
        <span class="dmeta">${d.file ? esc(d.file) + " · " : ""}${esc(dyn(d.hint))}</span>
        ${d.file ? `<button class="btn ghost" data-openfile="${d.id}" type="button" style="min-height:32px;padding:4px 10px;margin-left:8px">${tr("d.open")}</button>` : ""}
        </div>
        ${btn ? `<div><input type="file" id="f-${d.id}" accept=".pdf,.jpg,.jpeg,.png" hidden><label class="btn ${d.status === "ok" || d.status === "review" ? "ghost" : ""}" for="f-${d.id}">${btn}</label></div>` : "<div></div>"}
        ${d.reason ? `<div class="reason">${esc(tr("d.reason", { r: dyn(d.reason) }))}</div>` : ""}
      </li>`;
    }).join("");
    $$("#docList [data-openfile]").forEach(b => b.onclick = () => openDoc(b.dataset.openfile).catch(e => toast(e.message)));
    $$("#docList input[type=file]").forEach(i => {
      i.onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        const id = i.closest("li").dataset.id;
        const fd = new FormData();
        fd.append("file", f);
        try {
          await api.req(`/api/documents/${id}/upload`, { method: "POST", body: fd, headers: {} });
          toast(tr("d.done"));
          await load();
        } catch (err) { toast(err.message); }
      };
    });
  }

  function programCard(p) {
    const meta=fields[p.id] || {group:'it',symbol:p.code,tags:[]};
    const locked=C.application.submitted;
    return `<article class="specialty-card specialty-${meta.group}">
      <div class="specialty-top"><span class="specialty-symbol" aria-hidden="true">${esc(meta.symbol)}</span><span class="specialty-code">${copy('Бағдарлама','Программа')} ${esc(p.code)}</span><span class="specialty-index">${String(p.id).padStart(2,'0')}</span></div>
      <h3>${esc(pname(p))}</h3><p class="specialty-description">${esc(description(p))}</p>
      <div class="specialty-tags">${meta.tags.map(tag=>{const [kk,ru]=tag.split('|');return `<span>${esc(copy(kk,ru))}</span>`;}).join('')}</div>
      <div class="specialty-footer"><span>${copy('ҰБТ шегі','Порог ЕНТ')} <b>${esc(p.min_ent)}</b></span><button class="specialty-detail" type="button" data-detail="${p.id}" aria-label="${esc(copy('Толығырақ: ','Подробнее: ')+pname(p))}">${copy('Толығырақ','Подробнее')} <span aria-hidden="true">→</span></button></div>
      <button class="specialty-choose" type="button" data-choose="${p.id}">${locked?copy('Өтінішімді қарау','Посмотреть заявление'):copy('Осы мамандықты таңдау','Выбрать специальность')} <span aria-hidden="true">→</span></button>
    </article>`;
  }
  function programsView() {
    const search=($('#programSearch').value || '').trim().toLocaleLowerCase();
    const filtered = (filter,query='') => programs.filter(p=>(filter==='all'||fields[p.id]?.group===filter) && `${pname(p)} ${p.code} ${description(p)}`.toLocaleLowerCase().includes(query));
    const homePrograms=filtered(homeFilter), catalogPrograms=filtered(catalogFilter,search);
    const empty=`<div class="catalog-empty"><h3>${copy('Мамандық табылмады','Специальности не найдены')}</h3><p>${copy('Басқа сөзбен іздеңіз немесе бағытты өзгертіңіз.','Попробуйте другой запрос или измените направление.')}</p><button class="btn ghost" type="button" data-reset-search>${copy('Сүзгілерді тазарту','Сбросить фильтры')}</button></div>`;
    $('#homeProgCards').innerHTML=homePrograms.map(programCard).join('') || empty;
    $('#progCards').innerHTML=catalogPrograms.map(programCard).join('') || empty;
    $('#homeProgramCount').textContent=copy(`${homePrograms.length} мамандық`,`${homePrograms.length} специальностей`);
    $('#programCount').textContent=copy(`Табылды: ${catalogPrograms.length}`,`Найдено: ${catalogPrograms.length}`);
    $$('[data-filter-group]').forEach(el=>{
      const current=el.dataset.filterGroup==='home'?homeFilter:catalogFilter;
      el.setAttribute('aria-label',copy('Мамандық бағыттары','Направления обучения'));
      el.innerHTML=groups().map(([key,title])=>`<button type="button" data-filter="${key}" aria-pressed="${key===current}">${title}${key==='all'?` <span>${programs.length}</span>`:''}</button>`).join('');
    });
  }
  const detail=document.createElement('dialog');
  detail.className='program-dialog';detail.setAttribute('aria-labelledby','detail-title');document.body.append(detail);
  let detailProgram=null;
  function showDetail(id) {
    const p=programs.find(p=>p.id===id);if(!p)return;
    detailProgram=id;
    detail.innerHTML=`<button class="detail-close" type="button" aria-label="${copy('Жабу','Закрыть')}">×</button><p class="eyebrow">${copy('МАМАНДЫҚ ТУРАЛЫ','О СПЕЦИАЛЬНОСТИ')} · ${esc(p.code)}</p><h2 id="detail-title">${esc(pname(p))}</h2><p>${esc(description(p))}</p><dl class="detail-facts"><div><dt>${copy('ҰБТ шегі','Порог ЕНТ')}</dt><dd>${esc(p.min_ent)}</dd></div><div><dt>${tr('chip.grant')}</dt><dd>${esc(p.grants)}</dd></div><div><dt>${tr('chip.paid')}</dt><dd>${esc(p.paid)}</dd></div></dl><p class="catalog-hint">${copy('Қабылдау шарттары мен орындар санын комиссиядан нақтылаңыз.','Уточните условия приёма и количество мест у комиссии.')}</p><button class="btn" data-choose="${p.id}" type="button">${C.application.submitted?copy('Өтінішімді қарау','Посмотреть заявление'):copy('Осы мамандыққа өтініш беру','Подать заявление на эту специальность')}</button>`;
    detail.querySelector('.detail-close').onclick=()=>detail.close();
    if(!detail.open)detail.showModal();
  }
  document.addEventListener('click',event=>{
    const filter=event.target.closest('[data-filter]');
    if(filter){const group=filter.closest('[data-filter-group]');const focusKey=filter.dataset.filter;if(group.dataset.filterGroup==='home')homeFilter=focusKey;else catalogFilter=focusKey;programsView();group.querySelector(`[data-filter="${focusKey}"]`).focus();return;}
    if(event.target.closest('[data-reset-search]')){homeFilter='all';catalogFilter='all';$('#programSearch').value='';programsView();return;}
    const info=event.target.closest('[data-detail]');if(info){showDetail(Number(info.dataset.detail));return;}
    const choose=event.target.closest('[data-choose]');
    if(choose){
      if(detail.open)detail.close();
      if(!C.application.submitted){$('#a-prog').value=choose.dataset.choose;$('#a-prog').dispatchEvent(new Event('change'));}
      location.hash='#application';route();
      if(!C.application.submitted)$('#a-prog').focus();
    }
  });
  $('#programSearch').addEventListener('input',programsView);

  function notes() {
    $("#noteFull").innerHTML = C.notes.map(n => `<li class="${n.r ? "" : "unread"}">
      <span class="dotn"></span>
      <span>${n.r ? "" : "<b>"}${esc(dyn(n.t))}${n.r ? "" : "</b>"}<br><small>${fmt(n.d)}</small></span>
      ${n.r ? "" : `<button class="btn ghost" data-id="${n.id}" type="button" style="min-height:36px;padding:4px 12px">${tr("n.read")}</button>`}
    </li>`).join("") || `<li class="empty">${tr("n.none")}</li>`;
    $$("#noteFull [data-id]").forEach(b => b.onclick = run(async () => {
      await api.post(`/api/notes/${b.dataset.id}/read`, {});
      await load();
    }));
    const u = C.notes.filter(n => !n.r).length, bd = $("#noteCount");
    bd.textContent = u; bd.hidden = !u;
  }
  $("#readAll").onclick = run(async () => { await api.post("/api/notes/read-all", {}); await load(); });

  function help() {
    const L = lang();
    $("#faqBox").innerHTML = faqs.map(f => `<details><summary>${esc(L === "ru" ? f.q_ru : f.q_kk)}</summary><p>${esc(L === "ru" ? f.a_ru : f.a_kk)}</p></details>`).join("");
    $("#ticketList").innerHTML = C.tickets.length
      ? C.tickets.map(t => `<div class="ticket"><b>${esc(t.subject)}</b> <span class="chip ${esc(t.status)}">${esc(stLabel(t.status))}</span>
          <p>${esc(t.message)}</p>${t.reply ? `<p><i>${tr("h.reply")}</i> ${esc(t.reply)}</p>` : ""}</div>`).join("")
      : `<p class='empty'>${tr("h.none")}</p>`;
  }
  $("#ticketForm").onsubmit = async e => {
    e.preventDefault();
    try {
      await api.post("/api/tickets", { subject: $("#t-sub").value, message: $("#t-msg").value });
      $("#ticketForm").reset();
      toast(tr("h.sent"));
      await load();
    } catch (err) { toast(err.message); }
  };

  function profile() {
    const u = C.user, ini = (u.name || "?").trim().charAt(0).toUpperCase();
    $("#profileBox").innerHTML = `<div class="prof"><span class="avatar">${esc(ini)}</span>
      <div><h2 style="margin:0">${esc(u.name)}</h2><span class="dmeta">${tr("p.role")}</span></div></div>
      <form class="form" id="profForm">
        <label for="p-name">${tr("p.name")}</label><input id="p-name" value="${esc(u.name)}">
        <label for="p-phone">${tr("p.phone")}</label><input id="p-phone" value="${esc(u.phone)}">
        <dl class="sum"><dt>Email</dt><dd>${esc(u.email)}</dd><dt>${tr("p.iin")}</dt><dd>${esc(u.iin)}</dd></dl>
        <div class="actions"><button class="btn" type="submit">${tr("p.save")}</button></div>
      </form>
      <form class="form" id="pwForm" style="margin-top:24px">
        <h2>${tr("p.pwTitle")}</h2>
        <label for="p-cur">${tr("p.cur")}</label><input id="p-cur" type="password" autocomplete="current-password">
        <label for="p-new">${tr("p.new")}</label><input id="p-new" type="password" autocomplete="new-password">
        <div class="actions"><button class="btn ghost" type="submit">${tr("p.update")}</button></div>
      </form>
      <div class="actions"><button class="btn danger" id="logout" type="button">${tr("p.logout")}</button></div>`;
    $("#avatar").textContent = ini;
    $("#profForm").onsubmit = async e => {
      e.preventDefault();
      try {
        await api.put("/api/auth/profile", { name: $("#p-name").value, phone: $("#p-phone").value });
        toast(tr("p.saved")); await load();
      } catch (err) { toast(err.message); }
    };
    $("#pwForm").onsubmit = async e => {
      e.preventDefault();
      try {
        await api.post("/api/auth/password", { current: $("#p-cur").value, new_password: $("#p-new").value });
        toast(tr("p.pwOk"));
      } catch (err) { toast(err.message); }
    };
    $("#logout").onclick = async () => { await api.clear(); location.replace("/login.html"); };
  }

  const VIEWS = ["home", "application", "docs", "programs", "notes", "help", "profile"];
  function route() {
    let v = (location.hash || "#home").slice(1);
    if (!VIEWS.includes(v)) v = "home";
    $$("[data-view]").forEach(e => e.hidden = e.dataset.view !== v);
    $$("[data-nav]").forEach(a => a.dataset.nav === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    scrollTo(0, 0);
  }
  function renderAll() { cabinetLabels(); home(); application(); docs(); programsView(); notes(); help(); profile(); }
  addEventListener("hashchange", route);
  // тіл ауысқанда деректі қайта сұрамай-ақ қайта сызамыз
  addEventListener("abit-lang", () => {
    if (!C) return;
    // толтырылып жатқан өрістер жоғалмасын
    const keep = {};
    $$("#appBox [id], #profileBox [id]").forEach(el => {
      if (el.matches("input,select")) keep[el.id] = el.type === "checkbox" ? el.checked : el.value;
    });
    renderAll();
    if(detail.open && detailProgram)showDetail(detailProgram);
    Object.entries(keep).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "checkbox") el.checked = v; else el.value = v;
    });
  });
  $("#helpBtn").onclick = () => { location.hash = "#help"; };

  load().catch(err => {
    if (err.status === 401 || err.status === 403) { api.clear(); location.replace("/login.html"); }
    else toast(err.message || tr("c.loadFail"));
  });
})();
