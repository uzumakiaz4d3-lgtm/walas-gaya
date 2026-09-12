(function () {
  "use strict";

  var HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  var BULAN = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];

  var ATT_ORDER = ["H", "S", "I", "A", "D", "T"];
  var ATT_LABEL = {
    H: "H",
    S: "S",
    I: "I",
    A: "A",
    D: "D",
    T: "T"
  };

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function formatTanggal(date) {
    return (
      HARI[date.getDay()] +
      ", " +
      date.getDate() +
      " " +
      BULAN[date.getMonth()] +
      " " +
      date.getFullYear()
    );
  }

  function initDate() {
    $$("[data-today]").forEach(function (el) {
      el.textContent = formatTanggal(new Date());
    });
  }

  function initialsOf(name) {
    var parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "W";
    var first = parts[0].charAt(0) || "";
    var last = parts.length > 1 ? parts[1].charAt(0) || "" : "";
    return (first + last).toUpperCase();
  }

  function initTopbar() {
    var name = localStorage.getItem("userName") || "Wali Kelas";
    var role = localStorage.getItem("userRole") || "walas";
    var avatar = document.getElementById("tp-avatar");
    if (avatar) avatar.textContent = initialsOf(name);
    var pname = document.getElementById("tp-name");
    if (pname) pname.textContent = name;
    var prole = document.getElementById("tp-role");
    if (prole) prole.textContent = role === "admin" ? "Admin" : "Wali Kelas";
    var top = document.getElementById("pageTitleTop");
    var src = document.querySelector(".page-title, #kelasTitle");
    if (top && src) top.textContent = src.textContent;
  }

  function initNav() {
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    $$(".navlink").forEach(function (link) {
      var href = (link.getAttribute("href") || "").replace(/\/+$/, "") || "/";
      var isMatch =
        path === href ||
        (href !== "/" && (path === href || path.indexOf(href + "/") === 0));
      if (isMatch) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function ensureToastWrap() {
    var wrap = $("#toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toast-wrap";
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function WKToast(msg, type) {
    type = type || "success";
    if (["success", "error", "info"].indexOf(type) === -1) {
      type = "success";
    }
    var wrap = ensureToastWrap();
    var toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.setAttribute("role", "status");
    toast.textContent = msg;
    wrap.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  window.WKToast = WKToast;

  var XLS_LOADED = false;
  var XLS_QUEUE = [];
  function loadXLS(cb) {
    if (window.XLSX) {
      cb(true);
      return;
    }
    XLS_QUEUE.push(cb);
    if (XLS_LOADED) return;
    XLS_LOADED = true;
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = function () {
      XLS_QUEUE.forEach(function (c) { c(!!window.XLSX); });
      XLS_QUEUE = [];
    };
    s.onerror = function () {
      XLS_QUEUE.forEach(function (c) { c(false); });
      XLS_QUEUE = [];
    };
    document.head.appendChild(s);
  }

  window.WKLoadXLS = loadXLS;

  function initDrawer() {
    var drawer = $("#drawer");
    var openBtn = $("[data-open-drawer]");
    var closeBtn = $("[data-close-drawer]");
    var scrim = $(".scrim");

    function open() {
      if (drawer) drawer.classList.add("show");
      if (scrim) scrim.classList.add("show");
    }

    function close() {
      if (drawer) drawer.classList.remove("show");
      if (scrim) scrim.classList.remove("show");
    }

    if (openBtn) openBtn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (scrim) scrim.addEventListener("click", close);
  }

  function initModal() {
    var modals = $$(".modal");

    function closeModal(modal) {
      modal.classList.remove("show");
    }

    $$("[data-open-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-open-modal");
        var modal = id ? document.getElementById(id) : null;
        if (modal) modal.classList.add("show");
      });
    });

    $$("[data-close-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var modal = btn.closest(".modal");
        if (modal) closeModal(modal);
      });
    });

    modals.forEach(function (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal(modal);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        $$(".modal.show").forEach(closeModal);
      }
    });
  }

  function initSearch() {
    var input = $("[data-search-input]");
    if (!input) return;
    var target = input.getAttribute("data-search-input");
    var table = target ? document.querySelector(target) : null;
    if (!table) return;

    input.addEventListener("input", function () {
      var q = (input.value || "").toLowerCase().trim();
      $$("tbody tr", table).forEach(function (row) {
        row.style.display =
          q === "" || row.textContent.toLowerCase().indexOf(q) !== -1
            ? ""
            : "none";
      });
    });
  }

  function nextAtt(att) {
    var i = ATT_ORDER.indexOf(att);
    return ATT_ORDER[(i === -1 ? 0 : i + 1) % ATT_ORDER.length];
  }

  function refreshCounters() {
    var all = $$("[data-att]");
    var counts = { H: 0, S: 0, I: 0, A: 0, D: 0, T: 0 };
    all.forEach(function (btn) {
      var att = btn.getAttribute("data-att");
      if (counts.hasOwnProperty(att)) counts[att] += 1;
    });

    var total = all.length;
    var hadir = counts.H + counts.S;

    var map = {
      "c-hadir": hadir,
      "c-izin": counts.I,
      "c-alpa": counts.A,
      "c-terlambat": counts.T,
      "c-persen": total ? Math.round((hadir / total) * 100) : 0
    };

    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = map[id];
    });
  }

  function setAtt(btn, att) {
    btn.setAttribute("data-att", att);
    btn.classList.remove("st-H", "st-S", "st-I", "st-A", "st-D", "st-T");
    btn.classList.add("st-" + att);
    btn.textContent = ATT_LABEL[att] || att;
  }

  function initAttendance() {
    if (document.querySelector("[data-att-managed]")) return;

    $$("[data-att]").forEach(function (btn) {
      btn.classList.add("status");
      var current = btn.getAttribute("data-att");
      setAtt(btn, current);
      btn.addEventListener("click", function () {
        setAtt(btn, nextAtt(btn.getAttribute("data-att")));
        refreshCounters();
      });
    });

    var allHadir = $("#btn-all-hadir");
    if (allHadir) {
      allHadir.addEventListener("click", function () {
        $$("[data-att]").forEach(function (btn) {
          setAtt(btn, "H");
        });
        refreshCounters();
      });
    }

    refreshCounters();
  }

  function initBars() {
    var bars = $$("[data-bar]");
    if (!bars.length) return;

    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !("IntersectionObserver" in window)) {
      bars.forEach(function (bar) {
        bar.style.height = bar.getAttribute("data-bar") + "px";
      });
      return;
    }

    bars.forEach(function (bar) {
      bar.style.height = "0px";
    });

    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var bar = entry.target;
            bar.style.transition = "height 0.6s ease";
            bar.style.height = bar.getAttribute("data-bar") + "px";
            obs.unobserve(bar);
          }
        });
      },
      { threshold: 0.4 }
    );

    bars.forEach(function (bar) {
      obs.observe(bar);
    });
  }

  function initSidebarToggle() {
    var btnShow = document.getElementById("btn-show-sidebar");
    var aside = document.querySelector("aside");
    var main = document.querySelector("main");
    var topbar = document.getElementById("topbar");
    if (!btnShow || !aside || !main) return;
    function apply() {
      var hidden = localStorage.getItem("wkSidebarHidden") === "1";
      aside.style.display = hidden ? "none" : "";
      main.classList.toggle("md:pl-72", !hidden);
      if (topbar) topbar.classList.toggle("md:pl-72", !hidden);
      if (btnShow) btnShow.style.display = hidden ? "flex" : "none";
    }
    main.addEventListener("click", function () {
      if (
        (window.innerWidth || 0) >= 768 &&
        localStorage.getItem("wkSidebarHidden") !== "1"
      ) {
        localStorage.setItem("wkSidebarHidden", "1");
        apply();
      }
    });
    if (btnShow) {
      btnShow.addEventListener("click", function () {
        localStorage.setItem("wkSidebarHidden", "0");
        apply();
      });
    }
    apply();
  }

  function initLogout() {
    $$(".logout-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        try {
          fetch("/api/logout", { method: "POST" }).catch(function () {});
        } catch (e) {}
        localStorage.clear();
        sessionStorage.clear();
        window.location.href =
          location.protocol === "file:" ? "../index.html" : "/";
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initDate();
    initTopbar();
    initNav();
    initDrawer();
    initModal();
    initSearch();
    initAttendance();
    initBars();
    initSidebarToggle();
    initLogout();
  });
})();