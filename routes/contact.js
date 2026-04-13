const express = require("express");
const contactRateLimit = require("../middleware/middleware/contactRateLimit");
const { sendContactEmail } = require("../services/mail/contactMailer");

const router = express.Router();

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

    await sendContactEmail({
      name: String(name).trim(),
      email: String(email).trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      message: String(message).trim(),
    });

    res.redirect("/contact?sent=1");
  } catch (_err) {
    res.redirect("/contact?error=1");
  }
});

module.exports = router;

