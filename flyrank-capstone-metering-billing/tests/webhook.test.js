// TODO: forged signature -> 400; replay -> processed once.
// src/routes/webhooks.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const config = require('../config');
const db = require('../config/db');

const stripe = new Stripe(config.stripeSecretKey);

router.post('/', async (req, res, next) => {
  let event;

  // 1. VERIFY SIGNATURE — req.body is the raw Buffer here (thanks to express.raw() in server.js)
  try {
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' }); // forged webhook -> 400, nothing changes
  }

  try {
    // 2. DEDUPE — has this exact Stripe event id been processed before?
    const existing = await db.query(
      'SELECT 1 FROM processed_webhook_events WHERE stripe_event_id = $1',
      [event.id]
    );
    if (existing.rows.length > 0) {
      console.log(`Event ${event.id} already processed — ignoring replay`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    // 3. HANDLE — only now do we touch tenant/subscription state
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await handleSubscriptionChange(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await handleSubscriptionCanceled(sub);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // 4. record that we processed this event, so a replay is ignored next time
    await db.query(
      'INSERT INTO processed_webhook_events (stripe_event_id) VALUES ($1)',
      [event.id]
    );

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

async function handleCheckoutCompleted(session) {
  const tenantId = session.client_reference_id; // set this when creating the Checkout session
  const subscriptionId = session.subscription;

  await db.query('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [
    session.customer,
    tenantId,
  ]);

  const proPlan = await db.query(`SELECT id FROM plans WHERE name = 'pro'`);
  await db.query('UPDATE tenants SET plan_id = $1 WHERE id = $2', [proPlan.rows[0].id, tenantId]);

  await db.query(
    `INSERT INTO subscriptions (tenant_id, stripe_subscription_id, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = 'active', updated_at = now()`,
    [tenantId, subscriptionId]
  );
}

async function handleSubscriptionChange(sub) {
  await db.query(
    `UPDATE subscriptions SET status = $1, updated_at = now() WHERE stripe_subscription_id = $2`,
    [sub.status, sub.id]
  );
}

async function handleSubscriptionCanceled(sub) {
  const result = await db.query(
    `UPDATE subscriptions SET status = 'canceled', updated_at = now()
     WHERE stripe_subscription_id = $1 RETURNING tenant_id`,
    [sub.id]
  );
  if (result.rows.length > 0) {
    const freePlan = await db.query(`SELECT id FROM plans WHERE name = 'free'`);
    await db.query('UPDATE tenants SET plan_id = $1 WHERE id = $2', [
      freePlan.rows[0].id,
      result.rows[0].tenant_id,
    ]);
  }
}

module.exports = router;