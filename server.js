const express = require('express');
const stripe = require('stripe')('sk_test_REPLACE_WITH_YOUR_KEY');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  const { amount, vehicle, pickup, dropoff, date, time, name, email, phone } = req.body;

  try {
    const metadata = {
      vehicle,
      pickup,
      dropoff,
      date,
      time,
      customer_name: name,
      customer_phone: phone,
      customer_email: email
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: vehicle + ' - Airport Transfer',
            description: pickup + ' to ' + dropoff + '\nDate: ' + date + ' at ' + time,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://metroluxride.com/book?success=true',
      cancel_url: 'https://metroluxride.com/book?canceled=true',
      metadata: metadata,
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Metro LuxRide Payment API is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
