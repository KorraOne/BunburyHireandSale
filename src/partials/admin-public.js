(function () {
  // Admin-on-public logic (single source of truth).
  // No /admin/* requests are made from public pages.
  try {
    var TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
    var authed = localStorage.getItem("adminAuthed") === "1";
    var authedAt = Number(localStorage.getItem("adminAuthedAt"));
    var fresh = Number.isFinite(authedAt) && Date.now() - authedAt < TTL_MS;
    if (!authed || !fresh) return;
  } catch (e) {
    return;
  }

  // Expose to other public scripts (e.g., reorder toggle) without duplicating auth logic.
  window.__adminPublicAuthed = true;

  var a = document.createElement("a");
  a.href = "/admin";
  a.className = "btn btn-hero admin-fab";
  a.textContent = "Admin";
  document.body.appendChild(a);
})();

