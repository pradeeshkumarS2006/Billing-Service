// TODO: >=1 background job required by the brief (retries + failure alert).
// src/jobs/reconcile.js
require('dotenv').config();
const Stripe = require('stripe');
const db = require('../config/db');
const config = require('../config');

const stripe = new Stripe(config.stripeSecretKey);

async function reconcileOnce() {
  const { rows: subs } = await db.query(
    `SELECT s.id, s.tenant_id, s.stripe_subscription_id, s.status
     FROM subscriptions s
     WHERE s.stripe_subscription_id IS NOT NULL`
  );

  const report = { checked: 0, fixed: 0, failed: 0 };

  for (const sub of subs) {
    report.checked++;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

      if (stripeSub.status !== sub.status) {
        console.warn(
          `Drift found: tenant ${sub.tenant_id} local=${sub.status} stripe=${stripeSub.status}`
        );
        await db.query(
          `UPDATE subscriptions SET status = $1, updated_at = now() WHERE id = $2`,
          [stripeSub.status, sub.id]
        );

        if (stripeSub.status === 'active') {
          const proPlan = await db.query(`SELECT id FROM plans WHERE name = 'pro'`);
          await db.query(`UPDATE tenants SET plan_id = $1 WHERE id = $2`, [
            proPlan.rows[0].id,
            sub.tenant_id,
          ]);
        } else if (['canceled', 'unpaid'].includes(stripeSub.status)) {
          const freePlan = await db.query(`SELECT id FROM plans WHERE name = 'free'`);
          await db.query(`UPDATE tenants SET plan_id = $1 WHERE id = $2`, [
            freePlan.rows[0].id,
            sub.tenant_id,
          ]);
        }

        report.fixed++;
      }
    } catch (err) {
      // one bad subscription must not kill the whole job
      console.error(`Reconcile failed for subscription ${sub.stripe_subscription_id}:`, err.message);
      report.failed++;
    }
  }

  console.log('Reconcile report:', report);
  if (report.failed > 0) {
    // TODO: this is your "failure alert" — for the capstone, a log line is enough,
    // but note in BUILDLOG.md that a real system would page/email here.
    console.error(`ALERT: ${report.failed} subscription(s) could not be reconciled.`);
  }
  return report;
}

// Run directly: node src/jobs/reconcile.js
if (require.main === module) {
  reconcileOnce()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Reconcile job crashed:', err);
      process.exit(1);
    });
}

module.exports = { reconcileOnce };