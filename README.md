# Bunbury Hire & Sales

Static multi-page website + small Node/Express server + lightweight build step (DRY templates → static HTML).

## Project layout

- **Source (templates + page bodies)**: `src/`
  - `src/base.html`: shared layout wrapper
  - `src/partials/`: shared `head.html`, `nav.html`, `footer.html`, `admin-public.js`
  - `src/pages/`: per-page content blocks (`index.html`, `hire.html`, `sales.html`, `services.html`, `about.html`, `contact.html`)
  - `src/js/`: small JS modules (drawer + listings + bootstrap)
- **Build script**: `scripts/build.js`
- **Generated static output**: `dist/`
- **Assets (source)**: `public/` (CSS, images, vendor JS)
- **Data (source)**: `data/` (`items.json`, `contact_submissions.json`)
- **Admin UI**: `admin/` (protected by HTTP Basic Auth)
- **Server**: `server.js`

## Build

Generate the fully static pages (and bundle public JS) with:

```bash
npm run build
```

This produces:

- `dist/*.html` (fully static pages with inlined nav/footer/head)
- `dist/public/*` (copied assets)
- `dist/data/*` (copied data)
 
The Express server serves the public site from `dist/`.

## Keeping things simple (single source of truth)

- Edit **templates/pages/JS modules** in `src/`.
- Edit **assets** in `public/` and **data** in `data/`.
- Do not hand-edit `dist/` — it is generated and will be overwritten by `npm run build`.

Optional: you can migrate assets/data into `src/public` and `src/data`. The build script will prefer those folders if they exist.

## Deploy (recommended)

- Deploy the **contents of `dist/`** as your static site output.
- If you’re using the included Node/Express server, run `npm run build` as part of your deploy/start process (or commit `dist/`).

## Setup / run locally

1. Install Node.js.
2. Install dependencies:

```bash
npm install
```

3. Create `.env` (admin credentials + port):

Example `.env`:

```bash
# Server
PORT=3000

# Admin (HTTP Basic Auth)
ADMIN_USER=admin
ADMIN_PASS=your-strong-password

# Email (Your Host Details)
CONTACT_SMTP_HOST=Host
CONTACT_SMTP_PORT=465
CONTACT_SMTP_USER=sales@bunburyhire.com.au
CONTACT_SMTP_PASS=your-strong-password
```

4. Build and start:

```bash
npm run build
npm start
```

Open `http://localhost:PORT` (default: `http://localhost:3000`).

## Notes

- **GA4**: Included via shared head partial (`src/partials/head.html`) and ends up in every generated page.
- **Public pages must never call `/admin/*` automatically**: admin-on-public is handled by `src/partials/admin-public.js` (adds an Admin link based on localStorage only).
