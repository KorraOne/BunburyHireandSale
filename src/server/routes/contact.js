const express = require("express");
const fs = require("fs");
const https = require("https");
const path = require("path");
const contactRateLimit = require("../middleware/contactRateLimit");
const { sendContactEmail } = require("../services/mail/contactMailer");

const router = express.Router();

const CONTACT_LOG_FILE = path.join(__dirname, "..", "..", "..", "data", "contact_submissions.json");

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const e = email.trim();
  if (e.length === 0) return false;
  // Practical validation: good enough for form inputs.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function readSubmissionLog() {
  try {
    if (!fs.existsSync(CONTACT_LOG_FILE)) return [];
    const raw = fs.readFileSync(CONTACT_LOG_FILE, "utf8");
    if (!raw || raw.trim().length === 0) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendSubmissionLog(entry) {
  const list = readSubmissionLog();
  list.push(entry);

  const dir = path.dirname(CONTACT_LOG_FILE);
  fs.mkdirSync(dir, { recursive: true });

  const tmp = `${CONTACT_LOG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, CONTACT_LOG_FILE);
}

function postFormUrlEncoded(url, form) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(form).toString();
    const u = new URL(url);
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode || 0, text });
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function verifyTurnstile({ token, remoteIp }) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || String(secret).trim().length === 0) return { ok: false, reason: "missing_secret" };
  if (!token || String(token).trim().length === 0) return { ok: false, reason: "missing_token" };

  const { status, text } = await postFormUrlEncoded("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    secret: String(secret).trim(),
    response: String(token).trim(),
    ...(remoteIp ? { remoteip: String(remoteIp) } : {}),
  });

  if (status < 200 || status >= 300) return { ok: false, reason: `http_${status}` };
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "bad_json" };
  }
  if (parsed && parsed.success === true) return { ok: true };
  return { ok: false, reason: "failed", detail: parsed };
}

router.post("/contact-submit", contactRateLimit, async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { name, email, phone, message, website } = body;
    const turnstileToken = body["cf-turnstile-response"];

    // Honeypot (bots fill hidden fields).
    // Require field presence to block bots that omit it entirely.
    if (!Object.prototype.hasOwnProperty.call(body, "website")) {
      res.status(204).end();
      return;
    }
    if (isNonEmptyString(website)) {
      res.status(204).end();
      return;
    }

    // Turnstile (industry standard): require token + verify server-side.
    const turnstile = await verifyTurnstile({ token: turnstileToken, remoteIp: req.ip });
    if (!turnstile.ok) {
      res.redirect("/contact?error=1#send-message");
      return;
    }

    if (!isNonEmptyString(name) || !isNonEmptyString(message) || !isValidEmail(email)) {
      res.redirect("/contact?error=1#send-message");
      return;
    }

    const submission = {
      name: String(name).trim(),
      email: String(email).trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      message: String(message).trim(),
      timestamp: new Date().toISOString(),
      ip: req.ip,
    };

    try {
      await sendContactEmail({
        name: submission.name,
        email: submission.email,
        phone: submission.phone,
        message: submission.message,
      });
    } catch (err) {
      // Email send failed: preserve the submission server-side as fallback storage.
      try {
        appendSubmissionLog(submission);
      } catch (logErr) {
        console.error("Failed to write contact submissions log:", logErr);
      }
      console.error("Contact email send failed:", err);
      res.redirect("/contact?error=1#send-message");
      return;
    }

    res.redirect("/contact?sent=1#send-message");
  } catch (_err) {
    res.redirect("/contact?error=1#send-message");
  }
});

module.exports = router;

