{\rtf1\ansi\ansicpg1252\cocoartf2865
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fnil\fcharset0 .AppleSystemUIFontMonospaced-Regular;}
{\colortbl;\red255\green255\blue255;\red223\green223\blue223;\red29\green29\blue29;}
{\*\expandedcolortbl;;\cssrgb\c89804\c89804\c89804;\cssrgb\c14902\c14902\c14902;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs18 \cf2 \cb3 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 const express = require('express');\
const stripe = require('stripe')('sk_test_YOUR_STRIPE_SECRET_KEY_HERE');\
const cors = require('cors');\
\
const app = express();\
app.use(cors());\
app.use(express.json());\
\
app.post('/create-checkout-session', async (req, res) => \{\
  const \{ amount, vehicle, pickup, dropoff, date, time, name, email, phone \} = req.body;\
\
  try \{\
    // Create metadata to store booking details\
    const metadata = \{\
      vehicle,\
      pickup,\
      dropoff,\
      date,\
      time,\
      customer_name: name,\
      customer_phone: phone,\
      customer_email: email\
    \};\
\
    const session = await stripe.checkout.sessions.create(\{\
      payment_method_types: ['card'],\
      line_items: [\{\
        price_data: \{\
          currency: 'usd',\
          product_data: \{\
            name: `$\{vehicle\} - Airport Transfer`,\
            description: `$\{pickup\} \uc0\u8594  $\{dropoff\}\\nDate: $\{date\} at $\{time\}`,\
          \},\
          unit_amount: Math.round(amount * 100), // Convert to cents\
        \},\
        quantity: 1,\
      \}],\
      mode: 'payment',\
      success_url: 'https://metroluxride.com/book?success=true',\
      cancel_url: 'https://metroluxride.com/book?canceled=true',\
      metadata: metadata,\
    \});\
\
    res.json(\{ url: session.url \});\
  \} catch (error) \{\
    res.status(500).json(\{ error: error.message \});\
  \}\
\});\
\
// Health check endpoint\
app.get('/', (req, res) => \{\
  res.send('Metro LuxRide Payment API is running');\
\});\
\
const PORT = process.env.PORT || 3000;\
app.listen(PORT, () => console.log(`Server running on port $\{PORT\}`));
\fs20\fsmilli10286 \
}