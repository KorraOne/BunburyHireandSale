const rateLimit = require("express-rate-limit");

const contactRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many submissions. Please wait a moment.",
});

module.exports = contactRateLimit;

