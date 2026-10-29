const TOKEN_KEY = "abit-token";

const api = {
  token() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  },
  setToken(t, remember) {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
  },
  clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },
  async req(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    if (!headers["Content-Type"] && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const tok = this.token();
    if (tok) headers.Authorization = "Bearer " + tok;
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
    if (!res.ok) {
      let msg = (data && (data.detail || data.message)) || "Қате";
      if (Array.isArray(msg)) {
        msg = msg.map(e => `${(e.loc || []).filter(x => x !== "body").join(".")}: ${e.msg}`).join("; ");
      }
      const err = new Error(typeof msg === "string" ? dyn(msg) : JSON.stringify(msg));
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(p) { return this.req(p); },
  post(p, body) { return this.req(p, { method: "POST", body: JSON.stringify(body) }); },
  put(p, body) { return this.req(p, { method: "PUT", body: JSON.stringify(body) }); },
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(m) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 3200);
}

// тіл мен тақырып i18n.js ішінде басқарылады (getLang / setLang / tr / dyn)
function lang() {
  return getLang();
}

function t(dict) {
  return dict[lang()] || dict.kk || "";
}

async function openDoc(id) {
  // Open during the click event so browsers do not block the tab after fetch.
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const res = await fetch(`/api/documents/${id}/file`, {
      headers: { Authorization: "Bearer " + api.token() }
    });
    if (!res.ok) throw new Error(dyn("Файл ашылмады"));
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else {
      const link = document.createElement("a");
      link.href = url;
      link.download = "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    if (tab) tab.close();
    throw err;
  }
}
