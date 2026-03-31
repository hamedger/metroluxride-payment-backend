const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const YOUR_DOMAIN = 'https://metroluxride.com';

// Create Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, vehicle, pickup, dropoff, date, time, name, email, phone } = req.body;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Metro LuxRide - ${vehicle}`,
            description: `${pickup} → ${dropoff}\n${date} at ${time}\nPassenger: ${name}`,
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
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

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error:', error.message);
    // NEVER expose API key in response
    res.status(500).json({ 
      error: 'Payment processing failed. Please try again.' 
    });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
