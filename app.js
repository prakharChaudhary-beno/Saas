const express  = require("express");
const routes   = require("./route");
const passport = require("./config/passport");

const errorHandler    = require("./middlewares/error.middleware");
const notFoundHandler = require("./middlewares/notFound.middleware");
const securityMiddleware = require("./middlewares/security.middleware");

// // ── Seeders — run in this exact order ────────────────────────
// const { seedModules }     = require("./seeders/module.Seeders");
// const { seedPlans }       = require("./seeders/plan.Seeder");
// const { seedPermissions } = require("./seeders/permission.Seeder");
// const { seedRoles }       = require("./seeders/roleSeeder");
const requestLogger = require('./middlewares/requestLogger.middleware');
const auditLogMiddleware = require('./middlewares/auditLog.middleware');

// ─── Cron Jobs ────────────────────────────────────────────────
let cron;
try {
  cron = require('node-cron');
} catch (e) {
  console.warn('[Cron] node-cron not installed — run: npm install node-cron');
}

const app = express();

app.set("trust proxy", 1);

// ── Core middlewares ──────────────────────────────────────────
app.use(express.json());
securityMiddleware(app);
app.use(passport.initialize());
app.use(requestLogger);
app.use(auditLogMiddleware);


// ── Routes ────────────────────────────────────────────────────
app.use("/api/v1", routes);
// ── Health check ──────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Health check passed" });
});

// ── Run seeders on startup ────────────────────────────────────
// Order matters — each seeder depends on the previous one
// (async () => {
//   try {
//     await seedModules();      // 1. modules first
//     await seedPlans();        // 2. plans reference module slugs
//     await seedPermissions();  // 3. permissions before roles
//     await seedRoles();        // 4. roles reference permissions
//   } catch (err) {
//     console.error("❌ Seeder error:", err.message);
//   }
// })();

// ── Error handlers ────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Schedule Jobs ───────────────────────────────────────────
if (cron) {
  const { runAutoAbsentMarker } = require('./jobs/autoAbsentMarker.job');

  // Run every night at 11:55 PM
  cron.schedule('55 23 * * *', async () => {
    console.log('[Cron] Running auto absent marker...');
    try {
      await runAutoAbsentMarker();
    } catch (err) {
      console.error('[Cron] Auto absent marker failed:', err.message);
    }
  });

  console.log('[Cron] Auto absent marker scheduled — runs at 11:55 PM daily');
}

module.exports = app;