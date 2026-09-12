/* =====================================================================
   WKTheme — toggle tema warna. Disimpan per role (wkTheme_<role>),
   sehingga tema hanya terpampang di role yang mengaktifkannya.
   Cara kerja: menuangkan palet tema ke tailwind.config (Play CDN
   merebuild utility) + disinkronkan ke CSS variable di :root.
   ===================================================================== */
(function () {
  if (window.WKTheme) return;

  var THEMES = {
    default: { label: "Original", primary: "#1A3A5C", secondary: "#2A7A6B", accent: "#E89D3F", neutral: "#F5F6F8", danger: "#C23B22", info: "#2B6CB0" },
    ocean:   { label: "Samudra",  primary: "#0D3B66", secondary: "#0F8B8D", accent: "#F4A261", neutral: "#F4F7FA", danger: "#C23B22", info: "#2B6CB0" },
    forest:  { label: "Hutan",    primary: "#1F3D2B", secondary: "#2E7D5B", accent: "#E8A33D", neutral: "#F4F6F5", danger: "#C23B22", info: "#2B6CB0" },
    sunset:  { label: "Senja",    primary: "#4A1942", secondary: "#C65D7B", accent: "#E8A33D", neutral: "#F8F5F7", danger: "#C23B22", info: "#2B6CB0" },
    slate:   { label: "Batu",     primary: "#334155", secondary: "#5D7590", accent: "#C9A227", neutral: "#F3F5F7", danger: "#C23B22", info: "#2B6CB0" }
  };
  var ORDER = ["default", "ocean", "forest", "sunset", "slate"];
  var KEYS = ["primary", "secondary", "accent", "neutral", "danger", "info"];

  function role() {
    return localStorage.getItem("userRole") || "";
  }
  function key() {
    return "wkTheme_" + (role() || "anon");
  }
  function read() {
    var t = localStorage.getItem(key());
    return (t && THEMES[t]) ? t : "default";
  }
  function apply() {
    var id = read();
    var pal = THEMES[id] || THEMES.default;
    try {
      var tw = window.tailwind;
      if (tw) {
        tw.config = {
          theme: {
            extend: {
              colors: {
                primary: pal.primary,
                secondary: pal.secondary,
                accent: pal.accent,
                neutral: pal.neutral,
                danger: pal.danger,
                info: pal.info
              }
            }
          }
        };
        if (typeof tw.refresh === "function") tw.refresh();
      }
    } catch (e) {}
    try {
      var st = document.documentElement.style;
      KEYS.forEach(function (k) { st.setProperty("--" + k, pal[k]); });
    } catch (e) {}
    return id;
  }
  function next() {
    var cur = read();
    var id = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
    localStorage.setItem(key(), id);
    apply();
    markActive(id);
    return id;
  }
  function set(id) {
    if (!THEMES[id]) id = "default";
    localStorage.setItem(key(), id);
    apply();
    markActive(id);
    return id;
  }
  function markActive(id) {
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      var active = b.getAttribute("data-theme-set") === id;
      b.classList.toggle("ring-2", active);
      b.classList.toggle("ring-offset-2", active);
    });
  }
  function toast(msg) {
    if (typeof WKToast === "function") WKToast(msg);
  }

  window.WKTheme = {
    THEMES: THEMES,
    read: read,
    apply: apply,
    next: next,
    set: set,
    markActive: markActive
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (!role()) return;
    apply();
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        toast("Tema: " + THEMES[next()].label);
      });
    });
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.addEventListener("click", function () {
        toast("Tema: " + THEMES[set(b.getAttribute("data-theme-set"))].label);
      });
    });
    markActive(read());
  });
})();