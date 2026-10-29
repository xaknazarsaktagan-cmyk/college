(function () {
  const $ = s => document.querySelector(s);
  // мәтіндердің бәрі i18n.js сөздігінде (kk / ru); виджет оң жақ жоғарыда

  if (api.token()) {
    api.get("/api/auth/me").then(u => {
      location.replace(u.role === "admin" ? "/admin.html" : "/cabinet.html");
    }).catch(() => api.clear());
  }

  const flip = $("#flip"), lf = $("#loginFace"), rf = $("#regFace");
  const fit = () => { flip.style.height = (flip.classList.contains("on") ? rf : lf).offsetHeight + "px"; };
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(fit);
    ro.observe(lf); ro.observe(rf);
  }
  addEventListener("resize", fit); addEventListener("load", fit); fit();
  addEventListener("abit-lang", () => {
    document.querySelectorAll(".err").forEach(e => e.textContent = "");
    fit();
  });
  function show(reg) {
    flip.classList.toggle("on", reg); fit();
    lf.inert = reg; rf.inert = !reg;
    setTimeout(() => (reg ? $("#r-name") : $("#login")).focus(), 500);
  }
  if (location.hash === "#register") show(true);
  $("#toReg").onclick = () => show(true);
  $("#toLogin").onclick = () => show(false);

  document.querySelectorAll(".eye").forEach(b => b.onclick = () => {
    const i = document.getElementById(b.dataset.target);
    const h = i.type === "password";
    i.type = h ? "text" : "password";
    const sp = b.querySelector("span");
    sp.setAttribute("data-i18n", h ? "l.hide" : "l.show");
    sp.textContent = tr(h ? "l.hide" : "l.show");
  });

  function score(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[a-zа-яәғқңөұүһі]/i.test(p) && /\d/.test(p)) s++;
    if (/[A-ZА-Я]/.test(p) && /[a-zа-я]/.test(p)) s++;
    if (/[^\w\s]/.test(p) || p.length >= 12) s++;
    return s;
  }
  $("#r-pass").addEventListener("input", e => {
    const s = score(e.target.value), m = $("#meter");
    m.style.width = (s * 25) + "%";
    m.style.background = ["#b3261e", "#b3261e", "#e0a100", "#1f7a53", "#1f7a53"][s];
  });
  $("#r-iin").addEventListener("input", e => e.target.value = e.target.value.replace(/\D/g, ""));

  const set = (id, msg, inp) => {
    $("#" + id).textContent = msg || "";
    if (inp) inp.classList.toggle("bad", !!msg);
  };

  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const l = $("#login"), p = $("#pass");
    let ok = true;
    set("e-form", "");
    if (!l.value.trim()) { set("e-login", tr("l.eLogin"), l); ok = false; } else set("e-login", "", l);
    if (!p.value) { set("e-pass", tr("l.ePass"), p); ok = false; } else set("e-pass", "", p);
    if (!ok) return;
    const b = $("#loginBtn");
    b.disabled = true;
    b.textContent = "...";
    try {
      const data = await api.post("/api/auth/login", { login: l.value.trim(), password: p.value });
      api.setToken(data.token, $("#remember").checked);
      dispatchEvent(new Event("abit-login-ok"));
      setTimeout(() => {
        location.href = data.role === "admin" ? "/admin.html" : "/cabinet.html";
      }, matchMedia("(prefers-reduced-motion:reduce)").matches ? 200 : 900);
    } catch (err) {
      set("e-form", err.message);
      b.disabled = false;
      b.textContent = tr("l.enter");
    }
  });

  $("#regForm").addEventListener("submit", async e => {
    e.preventDefault();
    const n = $("#r-name"), i = $("#r-iin"), ph = $("#r-phone"), m = $("#r-mail"), p = $("#r-pass"), a = $("#r-agree");
    let ok = true;
    const chk = (c, id, msg, el) => { if (c) set(id, "", el); else { set(id, msg, el); ok = false; } };
    chk(n.value.trim().split(/\s+/).length >= 2, "e-rname", tr("l.eName"), n);
    chk(/^\d{12}$/.test(i.value), "e-riin", tr("l.eIin"), i);
    chk(/^\+?\d[\d\s()-]{9,}$/.test(ph.value.trim()), "e-rphone", tr("l.ePhone"), ph);
    chk(/^\S+@\S+\.\S+$/.test(m.value.trim()), "e-rmail", tr("l.eMail"), m);
    chk(score(p.value) >= 2 && p.value.length >= 8, "e-rpass", tr("l.eRpass"), p);
    if (!a.checked) { set("e-ragree", tr("l.eAgree")); ok = false; } else set("e-ragree", "");
    if (!ok) return;
    try {
      const data = await api.post("/api/auth/register", {
        name: n.value.trim(), iin: i.value, phone: ph.value.trim(),
        email: m.value.trim(), password: p.value
      });
      api.setToken(data.token, true);
      toast(tr("l.regOk"));
      dispatchEvent(new Event("abit-login-ok"));
      setTimeout(() => location.href = "/cabinet.html", 800);
    } catch (err) {
      set("e-rmail", err.message, m);
    }
  });
})();
