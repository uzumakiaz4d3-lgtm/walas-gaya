/* =====================================================================
   WKTheme — mode tampilan Gelap / Terang.
   Disimpan per role (wkTheme_<role> di localStorage) sehingga mode
   hanya berlaku untuk role yang mengaktifkannya.
   Terang = default. Gelap = class .wk-dark di <html> + remap utility
   netral (putih/abu/garis) via stylesheet override + CSS variable.
   ===================================================================== */
(function () {
  if (window.WKTheme) return;

  var LIGHT = {
    primary: "#1A3A5C", secondary: "#2A7A6B", accent: "#E89D3F",
    neutral: "#F5F6F8", surface: "#FFFFFF", ink: "#1A1D23",
    muted: "#6B7180", danger: "#C23B22", info: "#2B6CB0"
  };
  var DARK = {
    primary: "#1A3A5C", secondary: "#2A7A6B", accent: "#E89D3F",
    neutral: "#0F172A", surface: "#1E293B", ink: "#E2E8F0",
    muted: "#94A3B8", danger: "#E4573B", info: "#67A5E5"
  };
  var VARKEYS = ["primary", "secondary", "accent", "neutral", "surface", "ink", "muted", "danger", "info"];

  /* Remap utility netral agar tampil sesuai mode gelap (pakai !important
     biar selalu menang atas utility Tailwind apa pun urutannya). */
  var DARK_CSS = [
    "html.wk-dark{color-scheme:dark}",
    "html.wk-dark body{background-color:#0F172A!important;color:#E2E8F0!important}",
    "html.wk-dark .text-gray-50{color:#F8FAFC!important}",
    "html.wk-dark .text-gray-100{color:#F1F5F9!important}",
    "html.wk-dark .text-gray-200{color:#E2E8F0!important}",
    "html.wk-dark .text-gray-300{color:#CBD5E1!important}",
    "html.wk-dark .text-gray-400{color:#64748B!important}",
    "html.wk-dark .text-gray-500{color:#94A3B8!important}",
    "html.wk-dark .text-gray-600{color:#CBD5E1!important}",
    "html.wk-dark .text-gray-700{color:#E2E8F0!important}",
    "html.wk-dark .text-gray-800{color:#E2E8F0!important}",
    "html.wk-dark .text-gray-900{color:#F8FAFC!important}",
    "html.wk-dark .text-primary{color:#A5C4EA!important}",
    "html.wk-dark .text-secondary{color:#6FD3B8!important}",
    "html.wk-dark .text-accent{color:#F0B35C!important}",
    "html.wk-dark .text-danger{color:#F28B82!important}",
    "html.wk-dark .text-info{color:#67A5E5!important}",
    "html.wk-dark .hover\\:text-gray-600:hover{color:#E2E8F0!important}",
    "html.wk-dark .hover\\:text-gray-700:hover{color:#F8FAFC!important}",
    "html.wk-dark .bg-white{background-color:#1E293B!important}",
    "html.wk-dark .bg-neutral{background-color:#0F172A!important}",
    "html.wk-dark .bg-gray-50{background-color:#1A2437!important}",
    "html.wk-dark .bg-gray-50\\/50{background-color:rgba(26,36,55,.55)!important}",
    "html.wk-dark .bg-gray-100{background-color:#1E293B!important}",
    "html.wk-dark .bg-gray-200{background-color:#334155!important}",
    "html.wk-dark .bg-gray-300{background-color:#475569!important}",
    "html.wk-dark .bg-primary\\/10{background-color:rgba(26,58,92,.45)!important}",
    "html.wk-dark .bg-secondary\\/10{background-color:rgba(42,122,107,.4)!important}",
    "html.wk-dark .bg-accent\\/10{background-color:rgba(232,157,63,.3)!important}",
    "html.wk-dark .bg-danger\\/10{background-color:rgba(228,87,59,.3)!important}",
    "html.wk-dark .bg-info\\/10{background-color:rgba(103,165,229,.3)!important}",
    "html.wk-dark .hover\\:bg-gray-50:hover{background-color:#223049!important}",
    "html.wk-dark .hover\\:bg-gray-100:hover{background-color:#26354C!important}",
    "html.wk-dark .hover\\:bg-gray-200:hover{background-color:#334155!important}",
    "html.wk-dark .hover\\:bg-neutral\\/70:hover{background-color:rgba(250,250,250,.08)!important}",
    "html.wk-dark .border-gray-50{border-color:#334155!important}",
    "html.wk-dark .border-gray-100{border-color:#334155!important}",
    "html.wk-dark .border-gray-200{border-color:#334155!important}",
    "html.wk-dark .border-gray-300{border-color:#475569!important}",
    "html.wk-dark .divide-gray-50{border-color:#334155!important}",
    "html.wk-dark .divide-gray-100{border-color:#334155!important}",
    "html.wk-dark .divide-gray-200{border-color:#334155!important}",
    "html.wk-dark .ring-gray-100{border-color:#334155!important}",
    "html.wk-dark .ring-gray-200{border-color:#334155!important}"
  ].join("\n");

  function role() {
    return localStorage.getItem("userRole") || "";
  }
  function key() {
    return "wkTheme_" + (role() || "anon");
  }
  function read() {
    var v = localStorage.getItem(key());
    return v === "dark" ? "dark" : "light";
  }
  function setVars(pal) {
    try {
      var st = document.documentElement.style;
      VARKEYS.forEach(function (k) { st.setProperty("--" + k, pal[k]); });
    } catch (e) {}
  }
  function ensureDarkStyle() {
    if (document.getElementById("wk-dark-css")) return;
    var el = document.createElement("style");
    el.id = "wk-dark-css";
    el.textContent = DARK_CSS;
    document.head.appendChild(el);
  }
  function removeDarkStyle() {
    var el = document.getElementById("wk-dark-css");
    if (el) el.remove();
  }
  function apply(mode) {
    mode = mode === "dark" ? "dark" : "light";
    var root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("wk-dark");
      setVars(DARK);
      ensureDarkStyle();
    } else {
      root.classList.remove("wk-dark");
      setVars(LIGHT);
      removeDarkStyle();
    }
    return mode;
  }
  function toggle() {
    var mode = read() === "dark" ? "light" : "dark";
    localStorage.setItem(key(), mode);
    apply(mode);
    markActive(mode);
    return mode;
  }
  function set(mode) {
    mode = mode === "dark" ? "dark" : "light";
    localStorage.setItem(key(), mode);
    apply(mode);
    markActive(mode);
    return mode;
  }
  function markActive(mode) {
    document.querySelectorAll("[data-set-theme]").forEach(function (b) {
      var active = b.getAttribute("data-set-theme") === mode;
      b.classList.toggle("ring-2", active);
      b.classList.toggle("ring-offset-2", active);
    });
  }
  function toast(label) {
    if (typeof WKToast === "function") WKToast(label);
  }

  window.WKTheme = {
    read: read,
    apply: apply,
    toggle: toggle,
    set: set,
    markActive: markActive
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (!role()) return;
    apply(read());
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var mode = toggle();
        toast(mode === "dark" ? "Mode gelap aktif" : "Mode terang aktif");
      });
    });
    document.querySelectorAll("[data-set-theme]").forEach(function (b) {
      b.addEventListener("click", function () {
        var mode = set(b.getAttribute("data-set-theme"));
        toast(mode === "dark" ? "Mode gelap aktif" : "Mode terang aktif");
      });
    });
    markActive(read());
  });
})();