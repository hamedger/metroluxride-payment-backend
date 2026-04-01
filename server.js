require('dotenv').config();

const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

/**
 * Base URL for the booking page (no trailing slash, no /book).
 * Success/cancel URLs use `${SITE_URL}/book?...`.
 * Override PUBLIC_SITE_URL when moving to production (e.g. https://metroluxride.com).
 */
const DEFAULT_PUBLIC_SITE_URL =
  'https://app.landingsite.ai/website-chat/994c2c42-28ed-4090-99e3-9abf0d5aa48b';
const SITE_URL = (process.env.PUBLIC_SITE_URL || DEFAULT_PUBLIC_SITE_URL).replace(/\/$/, '');
if (!process.env.PUBLIC_SITE_URL) {
  console.warn(
    'PUBLIC_SITE_URL is not set — using Landingsite default. Set PUBLIC_SITE_URL in .env for production.'
  );
}

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  [
    'https://app.landingsite.ai',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://metroluxride.com',
    'https://www.metroluxride.com',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MIN_CHARGE_CENTS = 50;
const MAX_USD = Number(process.env.MAX_CHECKOUT_USD) || 50000;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY is not set. Stripe routes will fail until it is configured.');
}

const stripeMode = stripeSecretKey
  ? stripeSecretKey.startsWith('sk_live_')
    ? 'live'
    : stripeSecretKey.startsWith('sk_test_')
      ? 'test'
      : 'unknown_key_prefix'
  : 'unset';

console.log('Stripe configured:', Boolean(stripeSecretKey), 'mode:', stripeMode);

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

/** Bump when changing checkout responses — if Render responses lack this, an old build is still running. */
const PAYMENT_API_ID = 'metrolux-v3';

const app = express();

app.use((req, res, next) => {
  res.setHeader('X-Payment-API', PAYMENT_API_ID);
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    exposedHeaders: ['X-Payment-API'],
  })
);
app.use(express.json());

function metaValue(val, maxLen = 500) {
  if (val == null) return '';
  const s = String(val).trim();
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidCustomerEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim()) && email.length <= 256;
}

/**
 * Amount in whole dollars + cents, returns integer cents (no float drift, e.g. 500.31 → 50031).
 */
function parseAmountToCents(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'string' ? parseFloat(raw.trim()) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > MAX_USD) return null;
  const fixed = n.toFixed(2);
  const m = fixed.match(/^(\d+)\.(\d{2})$/);
  if (!m) return null;
  const cents = parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
  if (cents < MIN_CHARGE_CENTS) return null;
  return cents;
}

app.get('/', (req, res) => {
  res.json({
    status: 'Server is running',
    payment_api: PAYMENT_API_ID,
    stripe: Boolean(stripe),
    checkoutRedirects: SITE_URL,
    build: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || null,
    endpoints: {
      test: 'GET /test-stripe',
      checkout: 'POST /create-checkout-session',
    },
  });
});

app.get('/test-stripe', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      status: 'error',
      message: 'Stripe is not configured (missing STRIPE_SECRET_KEY)',
    });
  }
  try {
    await stripe.balance.retrieve();
    return res.json({
      status: 'connected',
      message: 'Stripe API key is valid.',
      mode: stripeSecretKey.startsWith('sk_live_') ? 'live' : 'test',
    });
  } catch (error) {
    console.error('Stripe test error:', error.type, error.code, error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Stripe request failed',
      type: error.type,
      code: error.code,
    });
  }
});

app.post('/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Payment service is not configured.',
      payment_api: PAYMENT_API_ID,
    });
  }

  const { amount, vehicle, pickup, dropoff, date, time, name, email, phone } = req.body;

  const unitAmountCents = parseAmountToCents(amount);
  if (unitAmountCents == null) {
    return res.status(400).json({
      error: 'Invalid amount. Send a positive dollar amount within allowed limits (min $0.50 USD).',
      payment_api: PAYMENT_API_ID,
    });
  }

  const amountNum = unitAmountCents / 100;

  try {
    const payload = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Metro LuxRide - ${metaValue(vehicle, 200) || 'Booking'}`,
              description: metaValue(
                `${pickup} -> ${dropoff}\n${date} at ${time}\nPassenger: ${name}`,
                500
              ),
            },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SITE_URL}/book?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/book?canceled=true`,
      metadata: {
        vehicle: metaValue(vehicle),
        pickup: metaValue(pickup),
        dropoff: metaValue(dropoff),
        date: metaValue(date),
        time: metaValue(time),
        name: metaValue(name),
        phone: metaValue(phone),
        amount: String(amountNum),
      },
    };

    if (isValidCustomerEmail(email)) {
      payload.customer_email = email.trim();
    }

    const session = await stripe.checkout.sessions.create(payload);

    res.json({ url: session.url, payment_api: PAYMENT_API_ID });
  } catch (error) {
    const raw = error.raw || error.response?.data?.error || error.response?.data || {};
    console.error('Checkout error:', {
      type: error.type,
      code: error.code,
      message: error.message,
      docUrl: error.doc_url,
      statusCode: error.statusCode,
      requestId: error.requestId,
      detail: raw.error || raw,
    });

    const msg =
      (typeof error.message === 'string' && error.message) ||
      (typeof raw.message === 'string' && raw.message) ||
      'Unknown error';

    const body = {
      error: 'Payment processing failed. Please try again.',
      payment_api: PAYMENT_API_ID,
      stripe: {
        sdk_type: error.type ?? null,
        sdk_code: error.code ?? null,
        request_id: error.requestId ?? raw.request_id ?? null,
        message: msg.slice(0, 500),
        doc_url: error.doc_url ?? null,
        param: error.param ?? raw.param ?? null,
        api_type: raw.type ?? null,
        api_code: raw.code ?? null,
      },
    };

    const exposeExtra =
      process.env.DEBUG_STRIPE_ERRORS === 'true' || process.env.NODE_ENV !== 'production';
    if (exposeExtra && error.raw) {
      body.raw = error.raw;
    }

    const authType = error.type === 'StripeAuthenticationError' || raw.type === 'authentication_error';
    if (authType) {
      body.hint =
        'Stripe rejected the secret key. On Render: set Environment → STRIPE_SECRET_KEY to your full sk_test_… or sk_live_… secret (not pk_…), no quotes, no extra spaces. Redeploy after saving.';
    }
    if (error.type === 'StripeInvalidRequestError' && error.code === 'resource_missing') {
      body.hint = 'Stripe could not find a requested object — check dashboard account matches this API key.';
    }

    res.status(500).json(body);
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
