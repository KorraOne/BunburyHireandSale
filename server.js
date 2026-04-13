require("dotenv").config();

const express = require("express");
const basicAuth = require("express-basic-auth");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

// Required behind Cloudflare Tunnel / reverse proxies (rate-limit relies on this for X-Forwarded-For)
app.set("trust proxy", 1);

const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "data", "items.json");
const PRODUCTS_DIR = path.join(ROOT_DIR, "public", "images", "products");
const PRODUCTS_DIR_RESOLVED = path.resolve(PRODUCTS_DIR) + path.sep;
const PLACEHOLDER_IMAGE = "/public/images/products/no_product_placeholder.webp";
const PLACEHOLDER_ABS = path.resolve(ROOT_DIR, PLACEHOLDER_IMAGE.replace(/^\/+/, ""));
const PLACEHOLDER_ABS_RESOLVED = path.resolve(PLACEHOLDER_ABS);
const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]);

function readItems() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeItems(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2) + "\n", "utf8");
}

function isUuid(id) {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function generateId(name) {
  // New schema prefers UUIDs; keep helper name for minimal changes.
  return crypto.randomUUID();
}

function normalizeTags(tags) {
  const raw = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const cleaned = raw.filter((t) => t === "hire" || t === "sale");
  const unique = Array.from(new Set(cleaned));
  unique.sort();
  return unique;
}

function normalizeOrder(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeIsoDate(value) {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function normalizeItem(rawItem, index, nowIso) {
  if (!rawItem || typeof rawItem !== "object") return null;

  const name = typeof rawItem.name === "string" ? rawItem.name.trim() : "";
  if (name.length === 0) return null;

  const id =
    typeof rawItem.id === "string" && rawItem.id.trim().length > 0
      ? rawItem.id.trim()
      : crypto.randomUUID();

  const description = typeof rawItem.description === "string" ? rawItem.description : "";
  const image = typeof rawItem.image === "string" ? rawItem.image : "";
  const alt = typeof rawItem.alt === "string" ? rawItem.alt : "";

  // Preserve existing fields used by current public site/admin
  const tags = normalizeTags(rawItem.tags);
  const imageFocus = rawItem.imageFocus && typeof rawItem.imageFocus === "object" ? rawItem.imageFocus : undefined;

  // Page-specific ordering: order.hire / order.sale
  let orderObj = rawItem.order && typeof rawItem.order === "object" ? rawItem.order : null;
  // Backward compat: old numeric order -> assign to the pages this item appears on
  if (!orderObj) {
    const numeric = normalizeOrder(rawItem.order);
    if (numeric !== null) {
      orderObj = {};
      if (tags.includes("hire")) orderObj.hire = numeric;
      if (tags.includes("sale")) orderObj.sale = numeric;
    }
  }
  if (!orderObj) orderObj = {};
  const orderHire = normalizeOrder(orderObj.hire);
  const orderSale = normalizeOrder(orderObj.sale);
  const dateAdded = normalizeIsoDate(rawItem.dateAdded) || nowIso;
  const dateUpdated = normalizeIsoDate(rawItem.dateUpdated) || nowIso;

  return {
    ...rawItem,
    id,
    name,
    description,
    image,
    alt,
    order: {
      ...(tags.includes("hire") ? { hire: orderHire } : {}),
      ...(tags.includes("sale") ? { sale: orderSale } : {}),
    },
    dateAdded,
    dateUpdated,
    tags,
    ...(imageFocus ? { imageFocus } : {}),
  };
}

function normalizeItems(items) {
  const nowIso = new Date().toISOString();
  const normalized = [];
  for (let i = 0; i < items.length; i += 1) {
    const n = normalizeItem(items[i], i, nowIso);
    if (n) normalized.push(n);
  }

  // Assign missing page-specific orders based on filtered index
  const hireItems = normalized.filter((it) => Array.isArray(it.tags) && it.tags.includes("hire"));
  const saleItems = normalized.filter((it) => Array.isArray(it.tags) && it.tags.includes("sale"));

  hireItems.sort((a, b) => (Number(a.order?.hire) || 0) - (Number(b.order?.hire) || 0));
  saleItems.sort((a, b) => (Number(a.order?.sale) || 0) - (Number(b.order?.sale) || 0));

  let hireIndex = 0;
  for (const it of hireItems) {
    if (!it.order || typeof it.order !== "object") it.order = {};
    if (!Number.isFinite(Number(it.order.hire))) it.order.hire = hireIndex;
    hireIndex += 1;
  }

  let saleIndex = 0;
  for (const it of saleItems) {
    if (!it.order || typeof it.order !== "object") it.order = {};
    if (!Number.isFinite(Number(it.order.sale))) it.order.sale = saleIndex;
    saleIndex += 1;
  }

  return normalized;
}

function parseImageFocus(body) {
  const x = Number(body?.cropX);
  const y = Number(body?.cropY);
  const focus = {
    x: Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 50,
    y: Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 50,
  };
  return focus;
}

function resolveProductFileFromImagePath(imagePath) {
  if (typeof imagePath !== "string") return null;
  const rel = imagePath.replace(/^\/+/, "");
  const abs = path.resolve(ROOT_DIR, rel);
  if (!abs.startsWith(PRODUCTS_DIR_RESOLVED)) return null;
  return abs;
}

function isPlaceholderPath(imagePath) {
  if (typeof imagePath !== "string") return false;
  const rel = imagePath.replace(/^\/+/, "");
  const abs = path.resolve(ROOT_DIR, rel);
  return path.resolve(abs) === PLACEHOLDER_ABS_RESOLVED;
}

function resolveValidImagePath(imagePath) {
  if (typeof imagePath !== "string" || imagePath.trim().length === 0) return PLACEHOLDER_IMAGE;
  if (isPlaceholderPath(imagePath)) return PLACEHOLDER_IMAGE;

  const abs = resolveProductFileFromImagePath(imagePath);
  if (!abs) return PLACEHOLDER_IMAGE;

  const ext = path.extname(abs).toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.has(ext)) return PLACEHOLDER_IMAGE;

  try {
    if (!fs.existsSync(abs)) return PLACEHOLDER_IMAGE;
  } catch {
    return PLACEHOLDER_IMAGE;
  }

  // Return normalized public path
  const filename = path.basename(abs);
  return `/public/images/products/${filename}`;
}

function safeDeleteImageByPath(imagePath) {
  if (isPlaceholderPath(imagePath)) return;
  const abs = resolveProductFileFromImagePath(imagePath);
  if (!abs) return;
  safeUnlink(abs);
}

function safeUnlink(absPath) {
  try {
    if (absPath && fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch {
    // ignore
  }
}

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "changeme";

const adminAuth = basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASS },
  challenge: true,
  realm: "Admin",
});

// Protect ALL admin routes (UI + API)
app.use("/admin", adminAuth);
app.use("/admin/api", adminAuth);

// Admin-only: messages viewer page (explicit route)
app.get("/admin/messages", adminAuth, (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "admin", "messages.html"));
});

// Admin-only: auth check for public pages
app.get("/admin/ping", adminAuth, (_req, res) => {
  res.json({ ok: true });
});

// Serve admin UI
app.use("/admin", express.static(path.join(ROOT_DIR, "admin"), { index: "index.html" }));

// Static files (public site)
app.use("/public", express.static(path.join(ROOT_DIR, "public")));

// Friendly page routes (so /contact maps to contact.html)
app.get("/contact", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "contact.html"));
});

// Serve top-level HTML pages (index.html, hire.html, contact.html, etc.)
app.use(express.static(ROOT_DIR));

// Form bodies (contact form)
app.use(express.urlencoded({ extended: false }));

// JSON body for admin API helpers (e.g., reorder)
app.use(express.json({ limit: "1mb" }));

// Public routes
app.use("/", require("./routes/contact"));

function makeStorage() {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRODUCTS_DIR),
    filename: (req, file, cb) => {
      const id = req.itemId || req.params.id;
      const ext = path.extname(file.originalname || "");
      cb(null, `${id}${ext}`);
    },
  });
}

const upload = multer({ storage: makeStorage() });

app.get("/admin/api/messages", (_req, res) => {
  const file = path.join(ROOT_DIR, "data", "contact_submissions.json");
  let messages = [];
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) messages = parsed;
      }
    }
  } catch {
    messages = [];
  }

  const sorted = [...messages].sort((a, b) => {
    const ta = Date.parse(a?.timestamp || "") || 0;
    const tb = Date.parse(b?.timestamp || "") || 0;
    return tb - ta;
  });

  res.json(sorted);
});

app.get("/admin/api/items", (req, res) => {
  const items = normalizeItems(readItems());
  let changed = false;
  const normalized = items.map((it) => {
    if (!it || typeof it !== "object") return it;
    const nextImage = resolveValidImagePath(it.image);
    if (it.image !== nextImage) changed = true;
    const focus = it.imageFocus && typeof it.imageFocus === "object" ? it.imageFocus : undefined;
    return { ...it, image: nextImage, ...(focus ? { imageFocus: focus } : {}) };
  });

  if (changed) writeItems(normalized);
  res.json(normalized);
});

app.post(
  "/admin/api/items",
  (req, _res, next) => {
    req.itemId = `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    next();
  },
  upload.single("image"),
  (req, res) => {
    const { name, description, alt } = req.body || {};
    const tags = normalizeTags(req.body?.tags);

    if (typeof name !== "string" || name.trim().length === 0) {
      if (req.file?.filename) safeUnlink(path.join(PRODUCTS_DIR, req.file.filename));
      res.status(400).json({ error: "Name is required." });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = generateId(name);

    let imagePath = PLACEHOLDER_IMAGE;
    if (req.file) {
      // Rename uploaded file from temp id to final id (keep extension)
      const ext = path.extname(req.file.filename);
      const finalFilename = `${id}${ext}`;
      const from = path.join(PRODUCTS_DIR, req.file.filename);
      const to = path.join(PRODUCTS_DIR, finalFilename);
      fs.renameSync(from, to);
      imagePath = `/public/images/products/${finalFilename}`;
    }

    const items = normalizeItems(readItems());
    const item = {
      id,
      name: name.trim(),
      description: typeof description === "string" ? description : "",
      image: resolveValidImagePath(imagePath),
      alt: typeof alt === "string" ? alt : "",
      order: {
        ...(tags.includes("hire") ? { hire: items.filter((it) => it.tags.includes("hire")).length } : {}),
        ...(tags.includes("sale") ? { sale: items.filter((it) => it.tags.includes("sale")).length } : {}),
      },
      dateAdded: nowIso,
      dateUpdated: nowIso,
      tags,
      imageFocus: parseImageFocus(req.body),
    };

    items.push(item);
    writeItems(items);
    res.status(201).json(item);
  }
);

app.put("/admin/api/items/:id", upload.single("image"), (req, res) => {
  const id = req.params.id;
  const items = normalizeItems(readItems());
  const idx = items.findIndex((it) => it && it.id === id);
  if (idx === -1) {
    if (req.file?.filename) safeUnlink(path.join(PRODUCTS_DIR, req.file.filename));
    res.status(404).json({ error: "Item not found." });
    return;
  }

  const existing = items[idx];
  const { name, description, alt } = req.body || {};
  const tags = normalizeTags(req.body?.tags);

  if (typeof name !== "string" || name.trim().length === 0) {
    if (req.file?.filename) safeUnlink(path.join(PRODUCTS_DIR, req.file.filename));
    res.status(400).json({ error: "Name is required." });
    return;
  }

  let newImagePath = resolveValidImagePath(existing.image);
  if (req.file) {
    const newFilename = req.file.filename;
    newImagePath = resolveValidImagePath(`/public/images/products/${newFilename}`);

    if (resolveValidImagePath(existing.image) !== newImagePath) {
      safeDeleteImageByPath(existing.image);
    }
  }

  const updated = {
    ...existing,
    name: name.trim(),
    description: typeof description === "string" ? description : "",
    tags,
    image: newImagePath,
    alt: typeof alt === "string" ? alt : "",
    imageFocus: parseImageFocus(req.body),
    dateUpdated: new Date().toISOString(),
  };

  items[idx] = updated;
  writeItems(items);
  res.json(updated);
});

app.post("/admin/api/items/reorderPage", (req, res) => {
  const page = req.body?.page;
  const list = req.body?.order;

  if (page !== "hire" && page !== "sale") {
    res.status(400).json({ success: false, error: "page must be 'hire' or 'sale'." });
    return;
  }

  if (!Array.isArray(list)) {
    res.status(400).json({ success: false, error: "order must be an array." });
    return;
  }

  const items = normalizeItems(readItems());
  const orderMap = new Map();
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.id !== "string") continue;
    const n = Number(entry.order);
    if (!Number.isFinite(n)) continue;
    orderMap.set(entry.id, n);
  }

  const nowIso = new Date().toISOString();
  let updatedCount = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (!orderMap.has(item.id)) continue;
    if (!Array.isArray(item.tags) || !item.tags.includes(page)) continue;
    if (!item.order || typeof item.order !== "object") item.order = {};
    item.order[page] = orderMap.get(item.id);
    item.dateUpdated = nowIso;
    updatedCount += 1;
  }

  writeItems(items);
  res.json({ success: true, updated: updatedCount });
});

app.delete("/admin/api/items/:id", (req, res) => {
  const id = req.params.id;
  const items = readItems();
  const idx = items.findIndex((it) => it && it.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Item not found." });
    return;
  }

  const [removed] = items.splice(idx, 1);
  writeItems(items);

  safeDeleteImageByPath(removed?.image);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

