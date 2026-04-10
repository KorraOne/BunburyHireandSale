document.addEventListener("DOMContentLoaded", () => {
  try {
    // Marks this browser session as admin-authenticated (after /admin login),
    // so public pages can enable reorder mode without probing protected routes.
    localStorage.setItem("adminAuthed", "1");
  } catch {
    // ignore
  }

  const PLACEHOLDER_IMAGE = "/public/images/products/no_product_placeholder.webp";

  function withPlaceholder(imagePath) {
    if (typeof imagePath !== "string" || imagePath.trim().length === 0) return PLACEHOLDER_IMAGE;
    return imagePath;
  }

  async function apiFetch(url, options = {}) {
    return fetch(url, options);
  }

  const els = {
    tbody: document.getElementById("itemsTbody"),
    empty: document.getElementById("emptyState"),

    createBtn: document.getElementById("createBtn"),

    formBackdrop: document.getElementById("formBackdrop"),
    formModal: document.getElementById("formModal"),
    formTitle: document.getElementById("formTitle"),
    cancelBtn: document.getElementById("cancelBtn"),
    form: document.getElementById("itemForm"),
    itemId: document.getElementById("itemId"),
    name: document.getElementById("nameInput"),
    desc: document.getElementById("descInput"),
    alt: document.getElementById("altInput"),
    tagHire: document.getElementById("tagHire"),
    tagSale: document.getElementById("tagSale"),
    image: document.getElementById("imageInput"),
    imageHelp: document.getElementById("imageHelp"),
    previewRow: document.getElementById("previewRow"),
    previewImg: document.getElementById("imagePreview"),
    saveBtn: document.getElementById("saveBtn"),
    cropX: document.getElementById("cropX"),
    cropY: document.getElementById("cropY"),
    cropField: document.getElementById("cropField"),
    cropFrame: document.getElementById("cropFrame"),
    cropImg: document.getElementById("cropImg"),

    deleteBackdrop: document.getElementById("deleteBackdrop"),
    deleteModal: document.getElementById("deleteModal"),
    deleteCancel: document.getElementById("deleteCancelBtn"),
    deleteConfirm: document.getElementById("deleteConfirmBtn"),
  };

  if (!els.tbody || !els.createBtn || !els.formModal || !els.deleteModal) {
    return;
  }

  let deleteId = null;
  let previewObjectUrl = null;
  let cropObjectUrl = null;
  let cropState = { x: 50, y: 50 };

  function clearPreview() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
    els.previewImg.src = "";
    els.previewRow.hidden = true;
  }

  function clearCropPreview() {
    if (cropObjectUrl) {
      URL.revokeObjectURL(cropObjectUrl);
      cropObjectUrl = null;
    }
    if (els.cropImg) els.cropImg.src = "";
    if (els.cropField) els.cropField.hidden = true;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function setCrop(x, y) {
    cropState = { x: clamp(Number(x) || 50, 0, 100), y: clamp(Number(y) || 50, 0, 100) };
    if (els.cropX) els.cropX.value = String(cropState.x);
    if (els.cropY) els.cropY.value = String(cropState.y);
    if (els.cropImg) els.cropImg.style.objectPosition = `${cropState.x}% ${cropState.y}%`;
  }

  function setModalOpen(modal, backdrop, isOpen) {
    modal.hidden = !isOpen;
    backdrop.hidden = !isOpen;
  }

  function closeForm() {
    setModalOpen(els.formModal, els.formBackdrop, false);
    els.form.reset();
    els.itemId.value = "";
    clearPreview();
    clearCropPreview();
    setCrop(50, 50);
  }

  function openCreateForm() {
    els.formTitle.textContent = "Create Item";
    els.itemId.value = "";
    els.image.required = false;
    els.imageHelp.textContent = "Optional for create (leave empty to use placeholder).";
    clearPreview();
    clearCropPreview();
    setCrop(50, 50);
    setModalOpen(els.formModal, els.formBackdrop, true);
    els.name.focus();
  }

  function openEditForm(item) {
    els.formTitle.textContent = "Edit Item";
    els.itemId.value = item.id;
    els.name.value = item.name || "";
    els.desc.value = item.description || "";
    els.alt.value = item.alt || "";
    const tags = Array.isArray(item.tags) ? item.tags : [];
    els.tagHire.checked = tags.includes("hire");
    els.tagSale.checked = tags.includes("sale");

    els.image.value = "";
    els.image.required = false;
    els.imageHelp.textContent = "Optional for edit (leave empty to keep current).";

    clearPreview();
    els.previewImg.src = withPlaceholder(item.image);
    els.previewRow.hidden = false;

    clearCropPreview();
    setCrop(item?.imageFocus?.x ?? 50, item?.imageFocus?.y ?? 50);
    if (els.cropImg && els.cropField) {
      els.cropImg.src = withPlaceholder(item.image);
      els.cropField.hidden = false;
      els.cropImg.style.objectPosition = `${cropState.x}% ${cropState.y}%`;
    }

    setModalOpen(els.formModal, els.formBackdrop, true);
    els.name.focus();
  }

  function openDeleteConfirm(id) {
    deleteId = id;
    setModalOpen(els.deleteModal, els.deleteBackdrop, true);
  }

  function closeDeleteConfirm() {
    deleteId = null;
    setModalOpen(els.deleteModal, els.deleteBackdrop, false);
  }

  function renderItems(items) {
    els.tbody.replaceChildren();

    if (!items || items.length === 0) {
      els.empty.hidden = false;
      return;
    }

    els.empty.hidden = true;

    const sortKey = (it) => {
      const h = Number(it?.order?.hire);
      const s = Number(it?.order?.sale);
      if (Number.isFinite(h) && Number.isFinite(s)) return Math.min(h, s);
      if (Number.isFinite(h)) return h;
      if (Number.isFinite(s)) return s;
      return 0;
    };

    const sorted = [...items].sort((a, b) => sortKey(a) - sortKey(b));
    for (const item of sorted) {
      const tr = document.createElement("tr");

      const tdThumb = document.createElement("td");
      const img = document.createElement("img");
      img.className = "thumb";
      img.alt = item.name || "Item image";
      img.src = withPlaceholder(item.image);
      img.loading = "lazy";
      tdThumb.appendChild(img);

      const tdName = document.createElement("td");
      tdName.textContent = item.name || "";

      const tdStatus = document.createElement("td");
      const badges = document.createElement("div");
      badges.className = "badges";
      const missing = [];
      if (!item.description || String(item.description).trim().length === 0) missing.push({ kind: "warn", text: "No description" });
      if (!item.image || String(item.image).trim().length === 0) missing.push({ kind: "bad", text: "No image" });
      if (!item.alt || String(item.alt).trim().length === 0) missing.push({ kind: "warn", text: "No alt text" });
      if (missing.length === 0) missing.push({ kind: "ok", text: "OK" });
      for (const m of missing) {
        const badge = document.createElement("span");
        badge.className = `badge badge-${m.kind}`;
        badge.textContent = m.text;
        badges.appendChild(badge);
      }
      tdStatus.appendChild(badges);

      const tdTags = document.createElement("td");
      const tagsWrap = document.createElement("div");
      tagsWrap.className = "tags";
      const tags = Array.isArray(item.tags) ? item.tags : [];
      for (const tag of tags) {
        const pill = document.createElement("span");
        pill.className = "tag";
        pill.textContent = tag;
        tagsWrap.appendChild(pill);
      }
      tdTags.appendChild(tagsWrap);

      const tdEdit = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-secondary";
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditForm(item));
      tdEdit.appendChild(editBtn);

      const tdDelete = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger";
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => openDeleteConfirm(item.id));
      tdDelete.appendChild(delBtn);

      tr.appendChild(tdThumb);
      tr.appendChild(tdName);
      tr.appendChild(tdStatus);
      tr.appendChild(tdTags);
      tr.appendChild(tdEdit);
      tr.appendChild(tdDelete);

      els.tbody.appendChild(tr);
    }
  }

  async function loadItems() {
    const res = await apiFetch("/admin/api/items");
    if (!res.ok) throw new Error("Failed to load items");
    const items = await res.json();
    renderItems(Array.isArray(items) ? items : []);
  }

  async function submitCreate(formData) {
    const res = await apiFetch("/admin/api/items", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Create failed");
    }
  }

  async function submitEdit(id, formData) {
    const res = await apiFetch(`/admin/api/items/${encodeURIComponent(id)}`, { method: "PUT", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Update failed");
    }
  }

  async function submitDelete(id) {
    const res = await apiFetch(`/admin/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Delete failed");
    }
  }

  els.createBtn.addEventListener("click", openCreateForm);
  els.cancelBtn.addEventListener("click", closeForm);
  els.formBackdrop.addEventListener("click", closeForm);

  els.deleteCancel.addEventListener("click", closeDeleteConfirm);
  els.deleteBackdrop.addEventListener("click", closeDeleteConfirm);
  els.deleteConfirm.addEventListener("click", async () => {
    if (!deleteId) return;
    try {
      await submitDelete(deleteId);
      closeDeleteConfirm();
      await loadItems();
    } catch (e) {
      alert(e.message || String(e));
    }
  });

  els.image.addEventListener("change", () => {
    clearPreview();
    const file = els.image.files && els.image.files[0];
    if (!file) return;
    previewObjectUrl = URL.createObjectURL(file);
    els.previewImg.src = previewObjectUrl;
    els.previewRow.hidden = false;

    clearCropPreview();
    cropObjectUrl = URL.createObjectURL(file);
    setCrop(50, 50);
    if (els.cropImg && els.cropField) {
      els.cropImg.src = cropObjectUrl;
      els.cropField.hidden = false;
      els.cropImg.style.objectPosition = `${cropState.x}% ${cropState.y}%`;
    }
  });

  if (els.cropFrame && els.cropImg) {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onMove = (clientX, clientY) => {
      const rect = els.cropFrame.getBoundingClientRect();
      const dx = clientX - lastX;
      const dy = clientY - lastY;
      lastX = clientX;
      lastY = clientY;

      // Drag right -> move focus left (so content follows finger)
      const nextX = cropState.x - (dx / rect.width) * 100;
      const nextY = cropState.y - (dy / rect.height) * 100;
      setCrop(nextX, nextY);
    };

    els.cropFrame.addEventListener("pointerdown", (e) => {
      if (els.cropField.hidden) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      els.cropFrame.setPointerCapture(e.pointerId);
    });

    els.cropFrame.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      onMove(e.clientX, e.clientY);
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try {
        els.cropFrame.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    els.cropFrame.addEventListener("pointerup", endDrag);
    els.cropFrame.addEventListener("pointercancel", endDrag);
  }

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!els.form.checkValidity()) {
      els.form.reportValidity();
      return;
    }

    const id = els.itemId.value.trim();
    const formData = new FormData();
    formData.set("name", els.name.value);
    formData.set("description", els.desc.value);
    formData.set("alt", els.alt.value);

    if (els.tagHire.checked) formData.append("tags", "hire");
    if (els.tagSale.checked) formData.append("tags", "sale");

    const file = els.image.files && els.image.files[0];
    if (file) formData.set("image", file);

    // Persist focus point used for card cropping
    formData.set("cropX", String(cropState.x));
    formData.set("cropY", String(cropState.y));

    els.saveBtn.disabled = true;
    try {
      if (id) {
        await submitEdit(id, formData);
      } else {
        await submitCreate(formData);
      }
      closeForm();
      await loadItems();
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      els.saveBtn.disabled = false;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!els.formModal.hidden) closeForm();
    if (!els.deleteModal.hidden) closeDeleteConfirm();
  });

  // Ensure both modals start closed even if CSS changes later
  setModalOpen(els.formModal, els.formBackdrop, false);
  setModalOpen(els.deleteModal, els.deleteBackdrop, false);

  loadItems().catch((e) => {
    els.empty.hidden = false;
    els.empty.textContent = e.message || "Failed to load items.";
  });
});

