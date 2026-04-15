const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

const read = (p) => fs.readFileSync(p, "utf8");
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const exists = (p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

const copyDir = (from, to) => {
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const dstPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, dstPath);
    else fs.copyFileSync(srcPath, dstPath);
  }
};

const clearDir = (dir) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
};

const replaceAll = (input, map) => {
  let out = input;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
};

const buildJsBundle = () => {
  const files = [
    path.join(SRC, "js", "drawer.js"),
    path.join(SRC, "js", "listings.js"),
    path.join(SRC, "js", "main.js"),
  ];
  return files.map((f) => read(f).trimEnd()).join("\n\n") + "\n";
};

const PAGES = [
  {
    out: "index.html",
    key: "home",
    title: "Bunbury Hire &amp; Sales — Industrial Equipment Hire &amp; Sales",
    description:
      "Industrial equipment hire and sales in Bunbury. From small tools to trailers, forklifts, tractors, and excavators.",
    bodyClass: "page-home",
    contentFile: "index.html",
    extraHead: "",
  },
  {
    out: "hire.html",
    key: "hire",
    title: "Hire Equipment — Bunbury Hire &amp; Sales",
    description:
      "Industrial equipment for hire in Bunbury. Tools, trailers, forklifts, tractors, excavators and more.",
    bodyClass: "",
    contentFile: "hire.html",
    extraHead: "",
  },
  {
    out: "sales.html",
    key: "sales",
    title: "Items for Sale — Bunbury Hire &amp; Sales",
    description:
      "Industrial equipment for sale in Bunbury. Tools, trailers, forklifts, tractors, excavators and more.",
    bodyClass: "",
    contentFile: "sales.html",
    extraHead: "",
  },
  {
    out: "services.html",
    key: "services",
    title: "Services — Bunbury Hire &amp; Sales",
    description:
      "Professional servicing and mechanical maintenance for industrial equipment, trailers, earthmoving machinery, and heavy-duty gear in Bunbury.",
    bodyClass: "",
    contentFile: "services.html",
    extraHead: "",
  },
  {
    out: "about.html",
    key: "about",
    title: "About — Bunbury Hire &amp; Sales",
    description:
      "Bunbury Hire & Sales is a family-run operation providing reliable industrial equipment for hire and sales in the South West.",
    bodyClass: "",
    contentFile: "about.html",
    extraHead: "",
  },
  {
    out: "contact.html",
    key: "contact",
    title: "Contact — Bunbury Hire &amp; Sales",
    description: "Reach out for hire availability, sales enquiries, or general questions.",
    bodyClass: "",
    contentFile: "contact.html",
    extraHead: "",
  },
];

function main() {
  clearDir(DIST);
  ensureDir(DIST);

  const base = read(path.join(SRC, "base.html"));
  const head = read(path.join(SRC, "partials", "head.html"));
  const nav = read(path.join(SRC, "partials", "nav.html"));
  const footer = read(path.join(SRC, "partials", "footer.html"));
  const adminPublic = read(path.join(SRC, "partials", "admin-public.js"));

  // Assets
  // Prefer src-owned assets if present (cleaner single source of truth).
  // Fallback to root folders for backwards compatibility.
  const publicSrc = exists(path.join(SRC, "public")) ? path.join(SRC, "public") : path.join(ROOT, "public");
  copyDir(publicSrc, path.join(DIST, "public"));

  // JS bundle (public)
  ensureDir(path.join(DIST, "public", "js"));
  fs.writeFileSync(path.join(DIST, "public", "js", "main.js"), buildJsBundle(), "utf8");

  for (const page of PAGES) {
    const content = read(path.join(SRC, "pages", page.contentFile));
    const pageHead = replaceAll(head, {
      title: page.title,
      description: page.description,
      headExtra: page.extraHead || "",
    });

    const pageNav = replaceAll(nav, {
      active_home: page.key === "home" ? " is-active" : "",
      active_hire: page.key === "hire" ? " is-active" : "",
      active_sales: page.key === "sales" ? " is-active" : "",
      active_services: page.key === "services" ? " is-active" : "",
      active_about: page.key === "about" ? " is-active" : "",
      active_contact: page.key === "contact" ? " is-active" : "",

      m_active_home: page.key === "home" ? " is-active" : "",
      m_active_hire: page.key === "hire" ? " is-active" : "",
      m_active_sales: page.key === "sales" ? " is-active" : "",
      m_active_services: page.key === "services" ? " is-active" : "",
      m_active_about: page.key === "about" ? " is-active" : "",
      m_active_contact: page.key === "contact" ? " is-active" : "",
    });

    const html = replaceAll(base, {
      head: pageHead,
      nav: pageNav,
      footer,
      adminPublic,
      bodyClass: page.bodyClass ? ` ${page.bodyClass}` : "",
      content,
    });

    fs.writeFileSync(path.join(DIST, page.out), html, "utf8");
  }
}

main();

