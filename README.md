# Bunbury Hire & Sales

Static website + small Node/Express server.

## What’s in here

- Public site pages: `index.html`, `hire.html`, `sales.html`, `about.html`, `contact.html`
- Public assets: `public/`
- Data source: `data/items.json`
- Contact submissions log (local safety net): `data/contact_submissions.json`
- Admin UI: `admin/` (protected by HTTP Basic Auth)
- Server: `server.js`

## Setup

1. Install Node.js.
2. Install dependencies:

```bash
npm install
```

3. Create `.env` (required for admin + contact form email):

Example `.env`:

```bash
# Server
PORT=3000

# Admin (HTTP Basic Auth)
ADMIN_USER=admin
ADMIN_PASS=your-strong-password

# Contact form SMTP (HostGator)
CONTACT_SMTP_HOST=cloud14.hostgator.com
CONTACT_SMTP_PORT=465
CONTACT_SMTP_USER=sales@bunburyhire.com.au
CONTACT_SMTP_PASS=PASSWORD
```

4. Start:

```bash
npm start
```
