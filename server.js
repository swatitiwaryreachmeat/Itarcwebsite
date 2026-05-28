const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Allow your website domain to call this server
// Change this to your actual domain when live
const allowedOrigins = [
  'https://itarcbusiness.com',
  'https://www.itarcbusiness.com',
  'http://localhost:3000', // for local testing
  'http://127.0.0.1:5500'  // for VS Code Live Server testing
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// Serve your website files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// ── THE PROXY ENDPOINT ──
// This is what the AI agent in your HTML calls
// It adds your secret API key and forwards to Anthropic
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not set. Add it to your environment variables.'
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: req.body.model || 'claude-sonnet-4-20250514',
        max_tokens: req.body.max_tokens || 1000,
        system: req.body.system,
        messages: req.body.messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json(data);
    }

    res.json(data);

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// Catch-all: serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ITARC server running on port ${PORT}`);
  console.log(`API key configured: ${process.env.ANTHROPIC_API_KEY ? 'YES ✅' : 'NO ❌ — add ANTHROPIC_API_KEY to env'}`);
});


