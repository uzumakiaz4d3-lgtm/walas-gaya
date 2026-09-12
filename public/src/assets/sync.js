/* =====================================================================
   WKSync — sinkronisasi data kelas via server (DB) dengan fallback
   localStorage agar tetap bisa dipakai offline.
   Pakai pola: server (DB) = sumber kebenaran lintas perangkat,
   localStorage = cache lokal yang di-render halaman.
   ===================================================================== */
(function () {
  if (window.WKSync) return;

  var CLASS_KEYS = ["siswa", "absensi", "admData", "pembinaan", "komunikasi"];

  function json(res) {
    try { return res.json(); } catch (e) { return Promise.resolve({ success: false }); }
  }
  function api(url, method, body) {
    var opts = { method: method, headers: { "Content-Type": "application/json" }, credentials: "same-origin" };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(json).catch(function () { return { success: false }; });
  }

  /* Membaca seluruh dokumen lokal milik satu kelas */
  function readLocal(kelas) {
    var out = {};
    CLASS_KEYS.forEach(function (k) {
      var v = localStorage.getItem(k + "_" + kelas);
      if (v !== null) { try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; } }
    });
    var c = localStorage.getItem("catatanTerakhir");
    if (c !== null) { try { out.catatan = JSON.parse(c); } catch (e) { out.catatan = c; } }
    return out;
  }

  /* Menulis dokumen server ke localStorage. Return true jika ada perubahan. */
  function writeLocal(kelas, doc) {
    if (!doc) return false;
    var changed = false;
    CLASS_KEYS.forEach(function (k) {
      if (doc[k] === undefined || doc[k] === null) return;
      var val = JSON.stringify(doc[k]);
      if (localStorage.getItem(k + "_" + kelas) !== val) {
        localStorage.setItem(k + "_" + kelas, val);
        changed = true;
      }
    });
    if (doc.catatan !== undefined && doc.catatan !== null) {
      var cv = JSON.stringify(doc.catatan);
      if (localStorage.getItem("catatanTerakhir") !== cv) {
        localStorage.setItem("catatanTerakhir", cv);
        changed = true;
      }
    }
    return changed;
  }

  function clearLocal(kelas) {
    CLASS_KEYS.forEach(function (k) { localStorage.removeItem(k + "_" + kelas); });
  }

  /* Dokumen dianggap "ada isi" bila membawa minimal satu key */
  function hasData(doc) {
    return !!doc && Object.keys(doc).length > 0;
  }

  /* Push satu key (di-debounce oleh pemanggil bila perlu) */
  function push(kelas, key, value) {
    if (!kelas) return Promise.resolve(false);
    return api("/api/kelas-data", "PUT", { kelas: kelas, key: key, value: value })
      .then(function (r) { return !!(r && r.success); });
  }

  /* ===== Dipanggil saat login walas =====
     - Server punya data  -> isi localStorage (server otoritatif)
     - Server kosong & sudah pernah sync -> admin telah reset, bersihkan lokal
     - Server kosong & lokal punya data (pindahan/legacy) -> push penuh sekali
     - Semua kosong -> akun baru, mulai kosong */
  function firstSync(kelas) {
    if (!kelas) return Promise.resolve("none");
    var flag = "wkSynced_" + kelas;
    return api("/api/kelas-data?kelas=" + encodeURIComponent(kelas), "GET")
      .then(function (r) {
        var doc = r && r.success ? r.data : null;
        if (doc && hasData(doc)) {
          writeLocal(kelas, doc);
          localStorage.setItem(flag, "server");
          return "server";
        }
        if (localStorage.getItem(flag)) {
          clearLocal(kelas);
          localStorage.removeItem(flag);
          return "reset";
        }
        var local = readLocal(kelas);
        if (hasData(local)) {
          return api("/api/kelas-data", "PUT", { kelas: kelas, data: local })
            .then(function (p) {
              if (p && p.success) { localStorage.setItem(flag, "local"); return "pushed"; }
              return "push-failed";
            });
        }
        return "fresh";
      })
      .catch(function () { return "error"; });
  }

  /* ===== Refresh saat halaman terbuka =====
     Tarik data server; bila berbeda dari lokal, tulis lalu reload sekali
     per sesi (penanda sessionStorage) supaya render memakai data terbaru. */
  function refresh(kelas) {
    if (!kelas) return Promise.resolve(false);
    return api("/api/kelas-data?kelas=" + encodeURIComponent(kelas), "GET")
      .then(function (r) {
        if (!r || !r.success || !r.data) return false;
        var flag = "wkRefreshed_" + kelas;
        if (writeLocal(kelas, r.data)) {
          if (!sessionStorage.getItem(flag)) {
            sessionStorage.setItem(flag, "1");
            try { location.reload(); } catch (e) {}
            return true;
          }
        } else {
          sessionStorage.removeItem(flag);
        }
        return true;
      })
      .catch(function () { return false; });
  }

  /* ===== Profil sekolah (global, dikelola admin) ===== */
  function syncSettings() {
    return api("/api/settings", "GET").then(function (r) {
      if (r && r.success && r.data && Object.keys(r.data).length) {
        var s = JSON.stringify(r.data);
        if (localStorage.getItem("wkSettings") !== s) localStorage.setItem("wkSettings", s);
        return true;
      }
      return false;
    });
  }
  function saveSettings(data) {
    return api("/api/settings", "PUT", { data: data }).then(function (r) { return !!(r && r.success); });
  }

  window.WKSync = {
    push: push,
    firstSync: firstSync,
    refresh: refresh,
    syncSettings: syncSettings,
    saveSettings: saveSettings,
    readLocal: readLocal,
    writeLocal: writeLocal,
    clearLocal: clearLocal
  };

  /* Auto: setelah halaman dimuat, walas menarik data terbaru kelasnya,
     admin menarik profil sekolah. */
  document.addEventListener("DOMContentLoaded", function () {
    var role = localStorage.getItem("userRole");
    if (role === "wali_kelas") {
      var k = localStorage.getItem("userKelas");
      if (!k) return;
      refresh(k).then(function () { syncSettings(); });
    } else if (role === "admin") {
      syncSettings();
    }
  });
})();