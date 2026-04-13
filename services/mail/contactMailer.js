const nodemailer = require("nodemailer");

function buildTransport() {
  const host = process.env.CONTACT_SMTP_HOST || "cloud14.hostgator.com";
  const port = Number(process.env.CONTACT_SMTP_PORT || 465);
  const user = process.env.CONTACT_SMTP_USER;
  const pass = process.env.CONTACT_SMTP_PASS;

  if (!user || !pass) {
    throw new Error("Missing CONTACT_SMTP_USER / CONTACT_SMTP_PASS.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: true,
    auth: { user, pass },
  });
}

async function sendContactEmail({ name, email, phone, message }) {
  const transport = buildTransport();

  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim();
  const cleanPhone = String(phone || "").trim();
  const cleanMessage = String(message || "").trim();

  const text = [
    "New contact form submission",
    "",
    `Name: ${cleanName}`,
    `Email: ${cleanEmail}`,
    `Phone: ${cleanPhone || "(not provided)"}`,
    "",
    "Message:",
    cleanMessage,
    "",
  ].join("\n");

  await transport.sendMail({
    from: `"Website Contact Form" <sales@bunburyhire.com.au>`,
    to: "sales@bunburyhire.com.au",
    subject: `New contact form message from ${cleanName}`,
    text,
    replyTo: cleanEmail,
  });
}

module.exports = { sendContactEmail };

