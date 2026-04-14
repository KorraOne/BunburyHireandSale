document.addEventListener("DOMContentLoaded", () => {
  initMobileDrawer();
  initHireSalesPages();
  initContactFormBanners();
});

function initContactFormBanners() {
  const sentEl = document.querySelector('[data-banner="sent"]');
  const errEl = document.querySelector('[data-banner="error"]');
  if (!sentEl && !errEl) return;

  const params = new URLSearchParams(window.location.search);
  const sent = params.get("sent") === "1";
  const error = params.get("error") === "1";

  if (sentEl) sentEl.style.display = sent ? "block" : "none";
  if (errEl) errEl.style.display = error ? "block" : "none";

  if (sent || error || window.location.hash === "#send-message") {
    const target = document.getElementById("send-message") || (sent ? sentEl : null) || (error ? errEl : null);
    if (target && typeof target.scrollIntoView === "function") {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
  }
}

