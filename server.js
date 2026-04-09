require("dotenv").config();

const express = require("express");
const basicAuth = require("express-basic-auth");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

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

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function generateId(name) {
  const base = slugify(name) || "item";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

function normalizeTags(tags) {
  const raw = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const cleaned = raw.filter((t) => t === "hire" || t === "sale");
  const unique = Array.from(new Set(cleaned));
  unique.sort();
  return unique;
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

// Serve admin UI
app.use("/admin", express.static(path.join(ROOT_DIR, "admin"), { index: "index.html" }));

// Static files (public site)
app.use("/public", express.static(path.join(ROOT_DIR, "public")));
app.use(express.static(ROOT_DIR));

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

app.get("/admin/api/items", (req, res) => {
  const items = readItems();
  let changed = false;
  const normalized = items.map((it) => {
    if (!it || typeof it !== "object") return it;
    const nextImage = resolveValidImagePath(it.image);
    if (it.image !== nextImage) changed = true;
    return { ...it, image: nextImage };
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
    const { name, description } = req.body || {};
    const tags = normalizeTags(req.body?.tags);

    if (typeof name !== "string" || name.trim().length === 0) {
      if (req.file?.filename) safeUnlink(path.join(PRODUCTS_DIR, req.file.filename));
      res.status(400).json({ error: "Name is required." });
      return;
    }

    if (typeof description !== "string") {
      if (req.file?.filename) safeUnlink(path.join(PRODUCTS_DIR, req.file.filename));
      res.status(400).json({ error: "Description is required." });
      return;
    }

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

    const items = readItems();
    const item = {
      id,
      name: name.trim(),
      description,
      image: resolveValidImagePath(imagePath),
      tags,
    };

    items.push(item);
    writeItems(items);
    res.status(201).json(item);
  }
);

app.put("/admin/api/items/:id", upload.single("image"), (req, res) => {
  const id = req.params.id;
  const items = readItems();
  const idx = items.findIndex((it) => it && it.id === id);
  if (idx === -1) {
    if (req.file?.filename) safeUnlink(path.join(PRODUCTS_DIR, req.file.filename));
    res.status(404).json({ error: "Item not found." });
    return;
  }

  const existing = items[idx];
  const { name, description } = req.body || {};
  const tags = normalizeTags(req.body?.tags);

  if (typeof name !== "string" || name.trim().length === 0) {
    if (req.file?.filename) safeUnlink(path.join(PRODUCTS_DIR, req.file.filename));
    res.status(400).json({ error: "Name is required." });
    return;
  }

  if (typeof description !== "string") {
    if (req.file?.filename) safeUnlink(path.join(PRODUCTS_DIR, req.file.filename));
    res.status(400).json({ error: "Description is required." });
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
    description,
    tags,
    image: newImagePath,
  };

  items[idx] = updated;
  writeItems(items);
  res.json(updated);
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

