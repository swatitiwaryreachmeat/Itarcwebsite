// ════════════════════════════════════════════════
// SECURITY ADDITIONS — add to top of server.js
// npm install helmet express-rate-limit cors
// ════════════════════════════════════════════════

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 1. Helmet — sets secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: false // set to true after testing
}));

// 2. Rate limiting — prevents abuse of upload endpoint
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 uploads per IP per 15 min
  message: { error: 'Too many uploads. Please try again in 15 minutes.' }
});
app.use('/api/upload', uploadLimiter);

// 3. Admin route rate limit
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60
});
app.use('/api/admin', adminLimiter);

// 4. Basic admin password protection
// Add ADMIN_PASSWORD to Render environment variables
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'changeme123';
app.use('/admin', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="ITARC Admin"');
    return res.status(401).send('Authentication required');
  }
  const [,encoded] = auth.split(' ');
  const [,password] = Buffer.from(encoded, 'base64').toString().split(':');
  if (password !== ADMIN_PASS) {
    return res.status(403).send('Forbidden');
  }
  next();
});

// 5. CORS — only allow your own domain
app.use(require('cors')({
  origin: [
    'https://itarcbusiness.com',
    'https://www.itarcbusiness.com',
    'https://itarcwebsiteflygrad.onrender.com'
  ]
}));

// 6. File type validation (already in multer, double-check)
const ALLOWED_TYPES = ['application/pdf','image/jpeg','image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// 7. Request size limit
app.use(require('express').json({ limit: '1mb' }));
app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));

// 8. Add to package.json dependencies:
// "helmet": "^7.1.0",
// "express-rate-limit": "^7.2.0"
