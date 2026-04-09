document.addEventListener("DOMContentLoaded", () => {
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
    tagHire: document.getElementById("tagHire"),
    tagSale: document.getElementById("tagSale"),
    image: document.getElementById("imageInput"),
    imageHelp: document.getElementById("imageHelp"),
    previewRow: document.getElementById("previewRow"),
    previewImg: document.getElementById("imagePreview"),
    saveBtn: document.getElementById("saveBtn"),

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

  function clearPreview() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
    els.previewImg.src = "";
    els.previewRow.hidden = true;
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
  }

  function openCreateForm() {
    els.formTitle.textContent = "Create Item";
    els.itemId.value = "";
    els.image.required = false;
    els.imageHelp.textContent = "Optional for create (leave empty to use placeholder).";
    clearPreview();
    setModalOpen(els.formModal, els.formBackdrop, true);
    els.name.focus();
  }

  function openEditForm(item) {
    els.formTitle.textContent = "Edit Item";
    els.itemId.value = item.id;
    els.name.value = item.name || "";
    els.desc.value = item.description || "";
    const tags = Array.isArray(item.tags) ? item.tags : [];
    els.tagHire.checked = tags.includes("hire");
    els.tagSale.checked = tags.includes("sale");

    els.image.value = "";
    els.image.required = false;
    els.imageHelp.textContent = "Optional for edit (leave empty to keep current).";

    clearPreview();
    els.previewImg.src = withPlaceholder(item.image);
    els.previewRow.hidden = false;

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

    for (const item of items) {
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
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = els.itemId.value.trim();
    const formData = new FormData();
    formData.set("name", els.name.value);
    formData.set("description", els.desc.value);

    if (els.tagHire.checked) formData.append("tags", "hire");
    if (els.tagSale.checked) formData.append("tags", "sale");

    const file = els.image.files && els.image.files[0];
    if (file) formData.set("image", file);

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

