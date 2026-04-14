function initMobileDrawer() {
  const openButton = document.querySelector(".nav-hamburger");
  const drawer = document.getElementById("mobile-drawer");
  const backdrop = document.querySelector("[data-drawer-backdrop]");

  if (!openButton || !drawer || !backdrop) return;

  const focusableSelector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const setOpen = (isOpen) => {
    openButton.setAttribute("aria-expanded", String(isOpen));
    openButton.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");

    if (isOpen) {
      drawer.hidden = false;
      backdrop.hidden = false;
      drawer.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => drawer.classList.add("is-open"));

      const firstFocusable = drawer.querySelector(focusableSelector);
      if (firstFocusable) firstFocusable.focus();
      return;
    }

    drawer.classList.remove("is-open");
    backdrop.hidden = true;
    window.setTimeout(() => {
      drawer.hidden = true;
      drawer.setAttribute("aria-hidden", "true");
    }, 200);

    openButton.focus();
  };

  openButton.addEventListener("click", () => setOpen(true));
  backdrop.addEventListener("click", () => setOpen(false));

  drawer.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openButton.getAttribute("aria-expanded") === "true") {
      setOpen(false);
    }

    if (e.key !== "Tab" || openButton.getAttribute("aria-expanded") !== "true") return;

    const focusables = Array.from(drawer.querySelectorAll(focusableSelector)).filter(
      (el) => el instanceof HTMLElement && !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
    );

    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

