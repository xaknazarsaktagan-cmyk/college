(function () {
  const $ = s => document.querySelector(s);
  const run = fn => async () => { try { await fn(); } catch (err) { toast(err.message); } };
  const $$ = s => [...document.querySelectorAll(s)];
  if (!api.token()) { location.replace("/login.html"); return; }

  // оқу тілдері — өз атауларымен (аударылмайды)
  const LANGS = { kk: "Қазақша", ru: "Русский", en: "English" };
  const STATUS_CHIP = { empty: "empty", up: "up", review: "review", ok: "ok", bad: "bad" };

  let C = null, programs = [], deadlines = [], faqs = [];

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
      el.innerHTML = `<div><h2>${tr("c.n1t")}</h2><p>${tr("c.n1d")}</p></div><a class="btn" href="#application">${tr("a.fill")}</a>`;
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
    $("#steps").innerHTML = [1, 2, 3, 4, 5, 6].map((k, i) => {
      const c = i < cur ? "done" : i === cur ? "now" : "";
      const st = i < cur ? tr("c.stDone") : i === cur ? tr("c.stNow") : tr("c.stWait");
      return `<li class="${c}"><span class="dot">${i < cur ? "✔" : i === cur ? "●" : i + 1}</span><span class="stitle">${tr("c.step" + k)} <small>(${st})</small></span><span class="sdesc">${tr("c.step" + k + "d")}</span></li>`;
    }).join("");
    const done = C.documents.filter(d => d.status === "ok" || d.status === "review").length;
    $("#hCount").textContent = `${done} / ${C.documents.length}`;
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

  function programsView() {
    $("#progCards").innerHTML = programs.map(p => `<article class="card prog-card">
      <span class="chip review">${esc(p.code)}</span>
      <h3>${esc(pname(p))}</h3>
      <p>${esc(dyn(p.faculty))} · ${esc(dyn(p.description))}</p>
      <div class="meta-row"><span class="chip ok">${tr("chip.grant")} ${p.grants}</span><span class="chip empty">${tr("chip.paid")} ${p.paid}</span><span class="chip exam">${tr("chip.ent")} ${p.min_ent}</span></div>
    </article>`).join("");
  }

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
    $("#logout").onclick = () => { api.clear(); location.replace("/login.html"); };
  }

  const VIEWS = ["home", "application", "docs", "programs", "notes", "help", "profile"];
  function route() {
    let v = (location.hash || "#home").slice(1);
    if (!VIEWS.includes(v)) v = "home";
    $$("[data-view]").forEach(e => e.hidden = e.dataset.view !== v);
    $$("[data-nav]").forEach(a => a.dataset.nav === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    scrollTo(0, 0);
  }
  function renderAll() { home(); application(); docs(); programsView(); notes(); help(); profile(); }
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
