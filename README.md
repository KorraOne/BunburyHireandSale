# Bunbury Hire & Sales

Static website + small Node/Express server.

## What’s in here

- Public site pages: `index.html`, `hire.html`, `sales.html`, `about.html`, `contact.html`
- Public assets: `public/`
- Data source: `data/items.json`
- Admin UI: `admin/` (protected by HTTP Basic Auth)
- Server: `server.js`

## Setup

1. Install Node.js.
2. Clone your repo and install deps:

```bash
git clone <url>
cd webpage
npm install
```

3. Create `.env`:

```bash
nano .env
```

Example:

```bash
ADMIN_USER=admin
ADMIN_PASS=your-strong-password
PORT=3000
```

4. Start:

```bash
npm start
```

## Notes

- `data/items.json` is tracked in git so the site works after cloning.
- Product images live in `public/images/products/`.
- The placeholder image is `public/images/products/no_product_placeholder.webp`.

