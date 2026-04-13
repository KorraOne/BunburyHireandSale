const express = require("express");
const fs = require("fs");
const path = require("path");
const contactRateLimit = require("../middleware/middleware/contactRateLimit");
const { sendContactEmail } = require("../services/mail/contactMailer");

const router = express.Router();

const CONTACT_LOG_FILE = path.join(__dirname, "..", "data", "contact_submissions.json");

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

router.post("/contact-submit", contactRateLimit, async (req, res) => {
  try {
    const { name, email, phone, message, website } = req.body || {};

    // Honeypot (bots fill hidden fields).
    if (website) {
      res.status(204).end();
      return;
    }

    if (!isNonEmptyString(name) || !isNonEmptyString(message) || !isValidEmail(email)) {
      res.redirect("/contact?error=1");
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
      appendSubmissionLog(submission);
    } catch (err) {
      console.error("Failed to write contact submissions log:", err);
    }

    await sendContactEmail({
      name: submission.name,
      email: submission.email,
      phone: submission.phone,
      message: submission.message,
    });

    res.redirect("/contact?sent=1");
  } catch (_err) {
    res.redirect("/contact?error=1");
  }
});

module.exports = router;

