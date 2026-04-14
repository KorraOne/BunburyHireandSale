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

function initHireSalesPages() {
  const PLACEHOLDER_IMAGE = "/public/images/products/no_product_placeholder.webp";
  const MISSING_DESC_MESSAGE = "No description or details have been added yet.";

  const isHirePage = Boolean(document.querySelector("[data-hire-grid]"));
  const isSalesPage = Boolean(document.querySelector("[data-sales-grid]"));
  if (!isHirePage && !isSalesPage) return;

  const normalizeTags = (tags) => (Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : []);
  const imageOrPlaceholder = (image) =>
    typeof image === "string" && image.trim().length > 0 ? image : PLACEHOLDER_IMAGE;

  const getPageOrder = (item, pageKey, fallback) => {
    const n = Number(item?.order?.[pageKey]);
    return Number.isFinite(n) ? n : fallback;
  };

  const setupReorderButton = async (pageKey, grid, itemsById, render) => {
    // Admin-only reorder toggle: use the single global set by admin-public.js (no localStorage duplication here).
    if (window.__adminPublicAuthed !== true) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reorder-toggle";
    btn.textContent = "Reorder Items";
    document.body.appendChild(btn);

    let reorderMode = false;
    let sortable = null;

    const setMode = (on) => {
      reorderMode = on;
      btn.textContent = on ? "Done Reordering" : "Reorder Items";
      document.body.classList.toggle("reorder-mode", on);

      for (const card of grid.querySelectorAll(".hire-card-flip")) {
        card.classList.toggle("reorder-enabled", on);
      }

      if (on) {
        if (typeof Sortable === "undefined") {
          alert("Reordering is unavailable (SortableJS failed to load).");
          reorderMode = false;
          document.body.classList.remove("reorder-mode");
          btn.textContent = "Reorder Items";
          return;
        }

        sortable = new Sortable(grid, {
          animation: 120,
          delay: 100,
          delayOnTouchOnly: false,
          touchStartThreshold: 5,
          forceFallback: true,
          fallbackOnBody: true,
          swapThreshold: 0.65,
          ghostClass: "drag-ghost",
          chosenClass: "drag-chosen",
          dragClass: "drag-dragging",
        });
      } else {
        if (sortable) {
          sortable.destroy();
          sortable = null;
        }
      }
    };

    const buildPayloadFromDom = () => {
      const cards = [...grid.querySelectorAll(".hire-card-flip")];
      return cards.map((c, idx) => ({ id: c.dataset.itemId, order: idx }));
    };

    btn.addEventListener("click", async () => {
      if (!reorderMode) {
        setMode(true);
        return;
      }

      // Persist current DOM order for this page only (explicit click only).
      try {
        const order = buildPayloadFromDom();
        const res = await fetch("/admin/api/items/reorderPage", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: pageKey, order }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Failed to save order (${res.status}) ${detail}`.trim());
        }
        const result = await res.json().catch(() => ({}));
        if (result && result.success !== true) {
          throw new Error(`Failed to save order (${res.status})`);
        }

        // Update in-memory and re-render in sorted order
        for (const entry of order) {
          const item = itemsById.get(entry.id);
          if (!item) continue;
          if (!item.order || typeof item.order !== "object") item.order = {};
          item.order[pageKey] = entry.order;
        }
        setMode(false);
        render();
      } catch (e) {
        // If auth expired, hide the button and stop showing reorder mode on public pages.
        if (String(e?.message || "").includes("(401)")) {
          btn.remove();
          document.body.classList.remove("reorder-mode");
          return;
        }
        alert(e.message || String(e));
      }
    });
  };

  const renderCards = (grid, pageKey, items) => {
    const fragment = document.createDocumentFragment();

    const sorted = [...items].sort(
      (a, b) => getPageOrder(a, pageKey, 0) - getPageOrder(b, pageKey, 0)
    );

    for (let i = 0; i < sorted.length; i += 1) {
      const item = sorted[i];
      const card = document.createElement("article");
      card.className = "hire-card hire-card-flip";
      card.tabIndex = 0;
      card.dataset.itemId = item.id;
      card.dataset.itemName = typeof item.name === "string" ? item.name : "";
      card.setAttribute("role", "button");
      const displayName =
        typeof item.name === "string" && item.name.trim().length > 0 ? item.name.trim() : "Item";
      card.setAttribute("aria-expanded", "false");
      card.setAttribute("aria-label", `${displayName}, show details`);

      const inner = document.createElement("div");
      inner.className = "hire-card-inner";

      const front = document.createElement("div");
      front.className = "hire-card-face hire-card-front";

      const img = document.createElement("img");
      img.src = imageOrPlaceholder(item.image);
      img.alt = typeof item.alt === "string" && item.alt.trim().length > 0 ? item.alt : item.name;
      img.loading = "lazy";
      if (item && item.imageFocus && typeof item.imageFocus === "object") {
        const x = Number(item.imageFocus.x);
        const y = Number(item.imageFocus.y);
        if (Number.isFinite(x) && Number.isFinite(y)) img.style.objectPosition = `${x}% ${y}%`;
      }

      const title = document.createElement("div");
      title.className = "hire-card-title";
      title.textContent = item.name;

      front.appendChild(img);
      front.appendChild(title);

      const back = document.createElement("div");
      back.className = "hire-card-face hire-card-back";

      const backTitle = document.createElement("div");
      backTitle.className = "hire-card-back-title";
      backTitle.textContent = item.name;

      const backDesc = document.createElement("div");
      backDesc.className = "hire-card-back-desc";
      const desc = typeof item.description === "string" ? item.description.trim() : "";
      backDesc.textContent = desc.length > 0 ? desc : MISSING_DESC_MESSAGE;
      if (desc.length === 0) backDesc.classList.add("is-empty");

      back.appendChild(backTitle);
      back.appendChild(backDesc);

      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);
      fragment.appendChild(card);
    }

    grid.replaceChildren(fragment);

    // Flip interaction (disabled during reorder mode)
    const toggle = (card) => {
      if (document.body.classList.contains("reorder-mode")) return;
      const isFlipped = card.classList.toggle("is-flipped");
      card.setAttribute("aria-expanded", String(isFlipped));
      const name =
        card.dataset.itemName && card.dataset.itemName.trim().length > 0
          ? card.dataset.itemName.trim()
          : "Item";
      card.setAttribute("aria-label", isFlipped ? `${name}, show front` : `${name}, show details`);
    };

    grid.onclick = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const card = target.closest(".hire-card-flip");
      if (!card) return;
      toggle(card);
    };

    grid.onkeydown = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const card = target.closest(".hire-card-flip");
      if (!card) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(card);
      }
    };
  };

  const loadAndRender = (pageKey, selector) => {
    const grid = document.querySelector(selector);
    if (!grid) return;

    fetch("/data/items.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load items.json");
        return res.json();
      })
      .then(async (items) => {
        const arr = Array.isArray(items) ? items : [];
        const filtered = arr.filter((item) => normalizeTags(item?.tags).includes(pageKey));

        // Assign missing order values for this page (client-side fallback)
        filtered.sort((a, b) => getPageOrder(a, pageKey, 0) - getPageOrder(b, pageKey, 0));
        for (let i = 0; i < filtered.length; i += 1) {
          if (!filtered[i].order || typeof filtered[i].order !== "object") filtered[i].order = {};
          if (!Number.isFinite(Number(filtered[i].order[pageKey]))) filtered[i].order[pageKey] = i;
        }

        const byId = new Map(filtered.map((it) => [it.id, it]));
        const render = () => renderCards(grid, pageKey, filtered);
        render();
        await setupReorderButton(pageKey, grid, byId, render);
      })
      .catch(() => {
        grid.textContent =
          pageKey === "hire"
            ? "No hire items available at the moment."
            : "No items for sale available at the moment.";
      });
  };

  loadAndRender("hire", "[data-hire-grid]");
  loadAndRender("sale", "[data-sales-grid]");
}

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
