const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Debug: Check if key is loaded
console.log('STRIPE_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
console.log('STRIPE_KEY starts with:', process.env.STRIPE_SECRET_KEY?.substring(0, 8));

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const YOUR_DOMAIN = 'https://metroluxride.com';

// Root endpoint - shows server status
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    endpoints: {
      test: 'GET /test-stripe',
      checkout: 'POST /create-checkout-session'
    }
  });
});

// Test endpoint to verify Stripe connection
app.get('/test-stripe', async (req, res) => {
  try {
    res.json({ 
      status: 'connected', 
      message: 'Stripe is working!',
      mode: 'live'
    });
  } catch (error) {
    console.error('Stripe Error:', error.message);
    res.status(500).json({ 
      error: 'Stripe connection failed',
      type: error.type
    });
  }
});

// Create Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, vehicle, pickup, dropoff, date, time, name, email, phone } = req.body;

    console.log('Creating checkout session for:', amount);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Metro LuxRide - ${vehicle}`,
            description: `${pickup} → ${dropoff}\n${date} at ${time}\nPassenger: ${name}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${YOUR_DOMAIN}/book?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${YOUR_DOMAIN}/book?canceled=true`,
      customer_email: email,
      metadata: {
        vehicle,
        pickup,
        dropoff,
        date,
        time,
        name,
        phone,
        amount: amount.toString()
      }
    });

    console.log('Session created:', session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout Error:', error.message);
    res.status(500).json({ 
      error: 'Payment processing failed. Please try again.' 
    });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
