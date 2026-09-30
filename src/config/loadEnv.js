import dotenv from "dotenv";

// Imported for its side effect only, and imported first (before app.js and
// its own dependency chain) — ES module imports fully execute in order
// before the importing file's own top-level code runs, so dotenv.config()
// must live in a module of its own that's imported ahead of anything that
// reads process.env at import time (e.g. utils/sendEmail.js's nodemailer
// transporter). Putting dotenv.config() directly in index.js's body doesn't
// work: its own imports (app.js and everything under it) would already have
// executed by then.
dotenv.config({ path: "./.env" });
