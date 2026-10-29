(function () {
  const $ = s => document.querySelector(s);
  if (!api.token()) { location.replace("/login.html"); return; }

  let D = null;                 // соңғы жүктелген деректер
  const openRows = new Set();   // ашық қатарлар тіл ауысқанда жабылмасын
  const stLabel = s => { const k = "s." + s; const v = tr(k); return v === k ? s : v; };
  const dsLabel = s => { const k = "ds." + s; const v = tr(k); return v === k ? s : v; };

  async function boot() {
    const me = await api.get("/api/auth/me");
    if (me.role !== "admin") { location.replace("/cabinet.html"); return; }
    await refresh();
  }

  async function refresh() {
    const [stats, apps, tickets] = await Promise.all([
      api.get("/api/admin/stats"),
      api.get("/api/admin/applications"),
      api.get("/api/admin/tickets")
    ]);
    D = { stats, apps, tickets };
    render();
  }

  function render() {
    if (!D) return;
    const { stats, apps, tickets } = D;
    $("#stats").innerHTML = [
      [tr("ad.s1"), stats.applicants],
      [tr("ad.s2"), stats.submitted],
      [tr("ad.s3"), stats.pending_docs],
      [tr("ad.s4"), stats.open_tickets]
    ].map(([l, v]) => `<div class="card stat"><b>${v}</b>${l}</div>`).join("");

    $("#appTable").innerHTML = `<thead><tr><th>№</th><th>${tr("ad.thApplicant")}</th><th>${tr("ad.thProg")}</th><th>${tr("ad.thEnt")}</th><th>${tr("ad.thDocs")}</th><th>${tr("ad.thStatus")}</th><th></th></tr></thead><tbody>` +
      (apps.length ? apps.map(a => `<tr>
        <td>${esc(a.number || "—")}</td>
        <td>${esc(a.user.name)}<br><small>${esc(a.user.email)}<br>${esc(a.user.iin)}</small></td>
        <td>${esc(dyn(a.program) || "—")}</td>
        <td>${esc(a.ent ?? "—")}</td>
        <td>${a.docs_ok}/${a.docs_total}</td>
        <td><span class="chip ${esc(a.status)}">${esc(stLabel(a.status))}</span></td>
        <td><button class="btn ghost" data-open="${a.id}" type="button" style="min-height:36px;padding:4px 10px">${tr("ad.open")}</button></td>
      </tr>
      <tr ${openRows.has(String(a.id)) ? "" : "hidden"} id="row-${a.id}"><td colspan="7"><div class="drawer">${a.docs.map(d => `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0">
          <b>${esc(dyn(d.name))}</b>
          <span class="chip ${esc(d.status)}">${esc(dsLabel(d.status))}</span>
          ${d.file ? `<button class="btn ghost" data-file="${d.id}" type="button" style="min-height:32px;padding:4px 10px">${esc(d.file)}</button>` : `<small>${tr("ad.noFile")}</small>`}
          ${d.status === "review" || d.status === "ok" || d.status === "bad" ? `
            <button class="btn ok" data-ok="${d.id}" type="button" style="min-height:34px">${tr("ad.accept")}</button>
            <button class="btn danger" data-bad="${d.id}" type="button" style="min-height:34px">${tr("ad.return")}</button>` : ""}
        </div>`).join("")}
        <div class="actions">
          <button class="btn" data-st="${a.id}" data-v="exam" type="button">${tr("ad.exam")}</button>
          <button class="btn ok" data-st="${a.id}" data-v="accepted" type="button">${tr("ad.accept")}</button>
          <button class="btn danger" data-st="${a.id}" data-v="rejected" type="button">${tr("ad.reject")}</button>
          <input placeholder="${esc(tr("ad.msgPh"))}" id="msg-${a.user.id}" style="flex:1;min-width:180px">
          <button class="btn ghost" data-msg="${a.user.id}" type="button">${tr("ad.send")}</button>
        </div>
      </div></td></tr>`).join("") : `<tr><td colspan="7" class="empty">${tr("ad.noApps")}</td></tr>`) + "</tbody>";

    $("#ticketBox").innerHTML = `<h2>${tr("ad.tickets")}</h2>` + (tickets.length ? tickets.map(t => `
      <div class="ticket">
        <b>${esc(t.subject)}</b> <span class="chip ${esc(t.status)}">${esc(stLabel(t.status))}</span>
        <p>${esc(t.user.name)} · ${esc(t.user.email)}</p>
        <p>${esc(t.message)}</p>
        ${t.reply ? `<p><i>${tr("h.reply")}</i> ${esc(t.reply)}</p>` : ""}
        <div class="actions">
          <input id="rep-${t.id}" placeholder="${esc(tr("ad.replyPh"))}" style="flex:1;min-width:200px">
          <button class="btn" data-rep="${t.id}" type="button">${tr("ad.replyBtn")}</button>
        </div>
      </div>`).join("") : `<p class='empty'>${tr("ad.noTickets")}</p>`);

    bind();
  }

  // кез келген әрекеттің қатесін тостқа шығарамыз
  const run = fn => async () => { try { await fn(); } catch (e) { toast(e.message); } };

  function bind() {
    document.querySelectorAll("[data-file]").forEach(b => b.onclick = () => openDoc(b.dataset.file).catch(e => toast(e.message)));
    document.querySelectorAll("[data-open]").forEach(b => b.onclick = () => {
      const id = b.dataset.open, row = document.getElementById("row-" + id);
      row.hidden = !row.hidden;
      row.hidden ? openRows.delete(id) : openRows.add(id);
    });
    document.querySelectorAll("[data-ok]").forEach(b => b.onclick = run(async () => {
      await api.post(`/api/admin/documents/${b.dataset.ok}/review`, { status: "ok" });
      toast(tr("ad.tAccepted")); await refresh();
    }));
    document.querySelectorAll("[data-bad]").forEach(b => b.onclick = run(async () => {
      // сервер әдепкі себепті қазақша сақтайды, көрсету кезінде аударылады
      const answer = prompt(tr("ad.why"));
      if (answer === null) return;
      const reason = answer.trim() || "Сапасы жеткіліксіз";
      await api.post(`/api/admin/documents/${b.dataset.bad}/review`, { status: "bad", reason });
      toast(tr("ad.tReturned")); await refresh();
    }));
    document.querySelectorAll("[data-st]").forEach(b => b.onclick = run(async () => {
      await api.post(`/api/admin/applications/${b.dataset.st}/status`, { status: b.dataset.v });
      toast(tr("ad.tStatus")); await refresh();
    }));
    document.querySelectorAll("[data-msg]").forEach(b => b.onclick = run(async () => {
      const text = document.getElementById("msg-" + b.dataset.msg).value;
      if (!text.trim()) return;
      await api.post("/api/admin/notify", { user_id: Number(b.dataset.msg), text });
      toast(tr("ad.tMsg")); await refresh();
    }));
    document.querySelectorAll("[data-rep]").forEach(b => b.onclick = run(async () => {
      const reply = document.getElementById("rep-" + b.dataset.rep).value;
      if (!reply.trim()) return;
      await api.post(`/api/admin/tickets/${b.dataset.rep}/reply`, { reply, status: "answered" });
      toast(tr("ad.tReply")); await refresh();
    }));
  }

  document.querySelectorAll("[data-tab]").forEach(a => a.onclick = e => {
    e.preventDefault();
    document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === a));
    $("#view-apps").hidden = a.dataset.tab !== "apps";
    $("#view-tickets").hidden = a.dataset.tab !== "tickets";
  });
  $("#logout").onclick = () => { api.clear(); location.replace("/login.html"); };
  addEventListener("abit-lang", render);

  boot().catch(err => {
    if (err.status === 401) { api.clear(); location.replace("/login.html"); }
    else toast(err.message);
  });
})();
