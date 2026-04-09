(() => {
  const openButton = document.querySelector(".nav-hamburger");
  const drawer = document.getElementById("mobile-drawer");
  const backdrop = document.querySelector("[data-drawer-backdrop]");

  if (!openButton || !drawer || !backdrop) return;

  const focusableSelector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const setOpen = (isOpen) => {
    openButton.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      drawer.hidden = false;
      backdrop.hidden = false;
      requestAnimationFrame(() => drawer.classList.add("is-open"));

      const firstFocusable = drawer.querySelector(focusableSelector);
      if (firstFocusable) firstFocusable.focus();
      return;
    }

    drawer.classList.remove("is-open");
    backdrop.hidden = true;
    window.setTimeout(() => {
      drawer.hidden = true;
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
})();

(() => {
  const grid = document.querySelector("[data-hire-grid]");
  if (!grid) return;

  const normalizeTags = (tags) => (Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : []);
  const imageOrPlaceholder = (image) =>
    typeof image === "string" && image.trim().length > 0
      ? image
      : "/public/images/products/no_product_placeholder.webp";

  const renderEmpty = () => {
    grid.textContent = "No hire items available at the moment.";
  };

  fetch("/data/items.json")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load items.json");
      return res.json();
    })
    .then((items) => {
      if (!Array.isArray(items)) {
        renderEmpty();
        return;
      }

      const hireItems = items.filter((item) => normalizeTags(item?.tags).includes("hire"));
      if (hireItems.length === 0) {
        renderEmpty();
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const item of hireItems) {
        if (!item || typeof item !== "object") continue;
        if (typeof item.name !== "string") continue;

        const card = document.createElement("article");
        card.className = "hire-card";

        const img = document.createElement("img");
        img.src = imageOrPlaceholder(item.image);
        img.alt = item.name;
        img.loading = "lazy";

        const title = document.createElement("div");
        title.className = "hire-card-title";
        title.textContent = item.name;

        card.appendChild(img);
        card.appendChild(title);
        fragment.appendChild(card);
      }

      grid.replaceChildren(fragment);
    })
    .catch(() => {
      renderEmpty();
    });
})();

(() => {
  const grid = document.querySelector("[data-sale-grid]");
  if (!grid) return;

  const normalizeTags = (tags) => (Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : []);
  const imageOrPlaceholder = (image) =>
    typeof image === "string" && image.trim().length > 0
      ? image
      : "/public/images/products/no_product_placeholder.webp";

  const renderEmpty = () => {
    grid.textContent = "No sale items available at the moment.";
  };

  fetch("/data/items.json")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load items.json");
      return res.json();
    })
    .then((items) => {
      if (!Array.isArray(items)) {
        renderEmpty();
        return;
      }

      const saleItems = items.filter((item) => normalizeTags(item?.tags).includes("sale"));
      if (saleItems.length === 0) {
        renderEmpty();
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const item of saleItems) {
        if (!item || typeof item !== "object") continue;
        if (typeof item.name !== "string") continue;

        const card = document.createElement("article");
        card.className = "hire-card";

        const img = document.createElement("img");
        img.src = imageOrPlaceholder(item.image);
        img.alt = item.name;
        img.loading = "lazy";

        const title = document.createElement("div");
        title.className = "hire-card-title";
        title.textContent = item.name;

        card.appendChild(img);
        card.appendChild(title);
        fragment.appendChild(card);
      }

      grid.replaceChildren(fragment);
    })
    .catch(() => {
      renderEmpty();
    });
})();
