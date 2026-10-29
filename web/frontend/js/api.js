const TOKEN_KEY = "narxoz-firebase-session";
let firebaseService;
const service = () => firebaseService || (firebaseService = import('./firebase-service.js'));
const api = {
  token() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); },
  setToken(t, remember) {
    localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, 'active');
  },
  async clear() {
    localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY);
    try { await (await service()).logout(); } catch (e) { console.warn('Firebase sign-out:',e.code||e.message); }
  },
  async req(path, opts = {}) {
    try { return await (await service()).request(path, opts); }
    catch (e) {
      const messages = {
        'auth/invalid-credential':'Email немесе құпиясөз қате',
        'auth/email-already-in-use':'Бұл email тіркелген',
        'auth/invalid-email':'Email форматы қате',
        'auth/weak-password':'Құпиясөз жеткілікті күрделі емес',
        'auth/network-request-failed':'Firebase байланысын тексеріңіз',
        'auth/too-many-requests':'Сұрау тым көп. Кейінірек қайталаңыз',
        'permission-denied':'Firebase рұқсаттары жеткіліксіз. Ережелер мен рөлді тексеріңіз',
        'storage/unauthorized':'Storage рұқсаты жоқ. Storage ережелерін тексеріңіз'
      };
      if (messages[e.code]) { const err = new Error(messages[e.code]); err.status=e.status; throw err; }
      throw e;
    }
  },
  get(p) { return this.req(p); },
  post(p, body) { return this.req(p, {method:'POST',body:JSON.stringify(body)}); },
  put(p, body) { return this.req(p, {method:'PUT',body:JSON.stringify(body)}); }
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
    const blob = await api.get(`/api/documents/${id}/file`);
    const url = URL.createObjectURL(blob);
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
