/**
 * ITARC Business — Secure Production Server
 * ─────────────────────────────────────────
 * Serves static files + proxies AI agent to Anthropic
 * API key stays on server — NEVER sent to browser
 *
 * Set ONE of these env variables on Render:
 *   ANTHROPIC_API_KEY   ← standard name
 *   ITARC_API_KEY       ← also accepted
 */

const express = require('express');
const path    = require('path');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;

// Accept either env variable name
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ITARC_API_KEY || '';

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── AI Agent System Prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT =
  "You are ITARC's friendly AI study abroad advisor for Indian students. " +
  "ITARC Business is a Mumbai-based consultancy helping students study in " +
  "Ireland, UK, Germany, Canada, Australia, USA & more. " +
  "Key facts: " +
  "Germany: tuition-free public universities (€0-350/semester), APS certificate required for Indians, " +
  "block account €11,208/yr, 18-month job seeker visa after graduation, EU Blue Card PR in 21-33 months. " +
  "Ireland: €10,000-25,000/yr, 2-year post-study visa, English medium, UCD QS#171, Trinity QS#81. " +
  "UK: 1-year Masters, Graduate Route 2-year visa, IELTS 6.0-7.0, Russell Group unis. " +
  "Canada: 3-year PGWP, Express Entry PR 2-3 years, SDS visa 20 days, IELTS 6.0+. " +
  "Australia: Group of Eight unis, 2-4 year post-study visa, healthcare & nursing PR priority. " +
  "USA: STEM OPT 3 years, GRE required for top unis, highest salary potential. " +
  "ITARC: free counselling, 97% visa success, 600+ students placed, +91 84549 92179, info@itarcbusiness.com. " +
  "Be helpful, concise (2-3 paragraphs max), warm and professional. " +
  "Always end with a call to action to book a free counselling session. Use emojis naturally.";

// ── Smart FAQ Fallback (works even if no API key set) ───────────────────────
const FAQ = {
  germany:
    "🇩🇪 Germany is the best value for Indian students! Public universities charge only €150–350/semester — nearly free tuition. " +
    "You need an APS certificate (ITARC guides you), a blocked account of €11,208, and IELTS 6.5+. " +
    "After graduation you get an 18-month job seeker visa. TU Munich, RWTH Aachen and Heidelberg are top picks.\n\n" +
    "📅 Book your free Germany counselling session with ITARC!",

  ireland:
    "🇮🇪 Ireland is India's #1 European destination! English-medium education, Google/Meta/LinkedIn all have EU HQs in Dublin, " +
    "and you get a 2-year post-study work permit after graduation. Tuition €10,000–25,000/yr, IELTS 6.0–6.5. " +
    "UCD (QS #171) and Trinity College are the top choices for Indian students.\n\n" +
    "📅 Book a free session — we'll build your personalised Ireland shortlist!",

  canada:
    "🇨🇦 Canada has the world's best PR pathway for students! Complete a 2-year degree → get a 3-year PGWP → " +
    "1 year work experience → Express Entry PR. The SDS visa fast-tracks approval in ~20 days. " +
    "University of Toronto, UBC, McGill and Waterloo are most popular with Indian students.\n\n" +
    "📅 Book a free session to map your complete Canada PR pathway!",

  uk:
    "🇬🇧 UK degrees are globally respected and most Masters are just 1 year — saving you a full year of costs. " +
    "After graduating you get the Graduate Route visa: 2 years open work rights (3 for PhD). " +
    "Oxford, Cambridge, UCL and Manchester are top choices. IELTS 6.0–7.0 required.\n\n" +
    "📅 Book your free UK counselling session today!",

  australia:
    "🇦🇺 Australia's Group of Eight universities are world-class. The post-study visa gives you 2–4 years to work. " +
    "Healthcare and nursing graduates get priority PR points under Skills in Demand visa. " +
    "Students can work 48hrs/fortnight at AUD 23+/hr minimum wage — one of the world's highest.\n\n" +
    "📅 Book a free session with our Australia specialist!",

  usa:
    "🇺🇸 USA has MIT, Stanford, CMU — the world's top research universities. STEM graduates get a 3-year OPT extension. " +
    "GRE is required for most MS programs. CS starting salaries are $110,000–140,000/yr. " +
    "Main challenge: 10–20+ year Green Card backlog for Indians.\n\n" +
    "📅 Book a free session to plan your USA application strategy!",

  ielts:
    "📝 IELTS requirements by country:\n" +
    "• Ireland: 6.0–6.5 overall\n" +
    "• UK: 6.0–7.0 (Russell Group: 6.5+)\n" +
    "• Germany (English programs): 6.5\n" +
    "• Canada SDS: 6.0 minimum each skill\n" +
    "• Australia: 6.0–6.5 (Go8 unis: 6.5+)\n" +
    "• USA: 6.5–7.5 plus GRE/GMAT\n\n" +
    "A 6.5 overall gives you access to the majority of universities across all destinations!\n\n" +
    "📅 Not sure if your score qualifies? Book a free check with our counsellors!",

  cost:
    "💰 Annual total costs for Indian students:\n" +
    "• Germany: ₹8–12L (nearly free tuition!)\n" +
    "• Ireland: ₹18–28L\n" +
    "• UK: ₹25–45L\n" +
    "• Canada: ₹28–48L\n" +
    "• Australia: ₹30–50L\n" +
    "• USA: ₹45–80L\n\n" +
    "Germany has the highest ROI by far! Book a free session for your personalised cost breakdown.",

  visa:
    "🛂 Student visa processing timelines:\n" +
    "• Germany: 8–12 weeks (book embassy appointment early)\n" +
    "• Ireland: 3–6 weeks\n" +
    "• UK: 3–4 weeks (priority available)\n" +
    "• Canada SDS: ~20 days — fastest!\n" +
    "• Australia: 4–6 weeks\n" +
    "• USA: 4–12 weeks (embassy interview required)\n\n" +
    "ITARC has a 97% visa success rate. We handle all documentation end-to-end!\n\n" +
    "📅 Book a free visa consultation today.",

  loan:
    "💳 Education loan options for study abroad:\n" +
    "• SBI: Up to ₹1.5 Cr from 8.5% p.a.\n" +
    "• HDFC Credila: Up to ₹1 Cr, specialist lender\n" +
    "• Avanse: Fast NBFC approval\n" +
    "• Axis Bank / Bank of Baroda: Both available\n\n" +
    "ITARC helps you prepare all documents and get your loan sanctioned BEFORE your visa appointment!\n\n" +
    "📅 Book a free loan guidance session.",

  pr:
    "🏡 Fastest PR pathways for Indian students:\n" +
    "🥇 Canada: Express Entry in 2–3 years (world's fastest)\n" +
    "🥈 Germany: EU Blue Card → PR in just 21 months\n" +
    "🥉 Australia: Skills in Demand visa → PR in 3–5 years\n" +
    "⚠️  USA: 10–20+ year Green Card backlog for Indians\n\n" +
    "Canada and Germany are your best bets for settling abroad long-term!\n\n" +
    "📅 Book a free PR strategy session with ITARC."
};

function getFAQReply(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('germany') || t.includes('german'))                          return FAQ.germany;
  if (t.includes('ireland') || t.includes('irish') || t.includes('dublin'))   return FAQ.ireland;
  if (t.includes('canada') || t.includes('pgwp') || t.includes('sds'))        return FAQ.canada;
  if (t.includes('uk') || t.includes('britain') || t.includes('england') ||
      t.includes('london') || t.includes('oxford') || t.includes('cambridge')) return FAQ.uk;
  if (t.includes('australia') || t.includes('sydney') || t.includes('melbourne')) return FAQ.australia;
  if (t.includes('usa') || t.includes('america') || t.includes('united states') ||
      t.includes('stanford') || t.includes('mit'))                            return FAQ.usa;
  if (t.includes('ielts') || t.includes('band score') || t.includes('english test')) return FAQ.ielts;
  if (t.includes('cost') || t.includes('fee') || t.includes('expensive') ||
      t.includes('cheap') || t.includes('afford') || t.includes('budget'))    return FAQ.cost;
  if (t.includes('visa') || t.includes('permit') || t.includes('immigration')) return FAQ.visa;
  if (t.includes('loan') || t.includes('bank') || t.includes('finance') ||
      t.includes('money') || t.includes('fund'))                              return FAQ.loan;
  if (t.includes('pr ') || t.includes('permanent') || t.includes('settle') ||
      t.includes('citizenship') || t.includes('residency'))                   return FAQ.pr;

  return (
    "Great question! 😊 I can help you with:\n\n" +
    "🌍 Best country for your MS / MBA / PhD profile\n" +
    "📊 Tuition fees and living costs by country\n" +
    "🛂 Visa process and processing timelines\n" +
    "💳 Education loans — banks, rates, documents\n" +
    "🏡 PR pathways — which country is fastest\n" +
    "📝 IELTS score requirements\n\n" +
    "Just type your question! Or book a FREE 30-min session with our counsellors for personalised guidance.\n\n" +
    "📅 Click 'Book Free Counselling' below."
  );
}

// ── /api/agent — Secure AI Proxy ────────────────────────────────────────────
app.post('/api/agent', (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // No API key → instant smart FAQ reply
  if (!API_KEY) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return res.json({ faq: getFAQReply(lastUser ? lastUser.content : '') });
  }

  // Proxy to Anthropic — key never leaves server
  const body = JSON.stringify({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 500,
    system:     SYSTEM_PROMPT,
    messages:   messages.slice(-10)
  });

  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers:  {
      'Content-Type':      'application/json',
      'Content-Length':    Buffer.byteLength(body),
      'x-api-key':         API_KEY,
      'anthropic-version': '2023-06-01'
    }
  };

  const proxyReq = https.request(options, proxyRes => {
    let data = '';
    proxyRes.on('data', chunk => { data += chunk; });
    proxyRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        // Forward Anthropic response directly to browser
        res.json(parsed);
      } catch (e) {
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        res.json({ faq: getFAQReply(lastUser ? lastUser.content : '') });
      }
    });
  });

  proxyReq.on('error', () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    res.json({ faq: getFAQReply(lastUser ? lastUser.content : '') });
  });

  proxyReq.write(body);
  proxyReq.end();
});

// ── Counselling form ────────────────────────────────────────────────────────
app.post('/api/counselling', (req, res) => {
  const { name, email, phone } = req.body || {};
  console.log('📋 New counselling request:', name, '|', email, '|', phone);
  res.json({ success: true });
});

// ── Serve index.html for all other routes ───────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🚀  ITARC Business server running on port ' + PORT);
  console.log('    API key configured: ' + (API_KEY ? 'YES ✅  — AI agent active' : 'NO ❌  — add ANTHROPIC_API_KEY or ITARC_API_KEY to env'));
  console.log('');
});
