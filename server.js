require('dotenv').config();
const express    = require('express');
const multer     = require('multer');
const cors       = require('cors');
const path       = require('path');
const { google } = require('googleapis');
const sgMail     = require('@sendgrid/mail');
const crypto     = require('crypto');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const app = express();

// ── Security: HTTP headers ────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── Security: CORS — only allow your domains ──────
app.use(cors({
  origin: [
    'https://itarcbusiness.com',
    'https://www.itarcbusiness.com',
    'https://itarcwebsiteflygrad.onrender.com'
  ]
}));

// ── Security: Rate limiting ───────────────────────
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Too many uploads. Please try again in 15 minutes.' }
});
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// ── Security: Admin basic auth ────────────────────
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'itarc2025admin';
app.use('/admin', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="ITARC Admin"');
    return res.status(401).send('Authentication required');
  }
  const [, encoded] = auth.split(' ');
  const [, password] = Buffer.from(encoded, 'base64').toString().split(':');
  if (password !== ADMIN_PASS) return res.status(403).send('Forbidden');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static('public'));

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const STUDENTS = [];

// ── Get auth token ────────────────────────────────
async function getAccessToken() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

// ── Create student folder via REST API ───────────
async function createStudentFolder(studentName, country, level, course) {
  const year = new Date().getFullYear();
  const safeName = studentName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-');
  const safeCountry = country.replace(/\s+/g, '-');
  const levelShort = { "Bachelor's": 'BSc', "Master's": 'MS', "MBA": 'MBA', "PhD": 'PhD' }[level] || level;
  const folderName = year + '-' + safeName + '-' + safeCountry + '-' + levelShort;

  const token = await getAccessToken();

  // Create folder directly inside shared parent folder
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID]
      })
    }
  );

  const folder = await res.json();
  if (folder.error) throw new Error('Folder creation failed: ' + folder.error.message);

  // Make folder readable by anyone with link
  await fetch(
    'https://www.googleapis.com/drive/v3/files/' + folder.id + '/permissions?supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    }
  );

  return {
    folderId: folder.id,
    folderName: folderName,
    folderLink: 'https://drive.google.com/drive/folders/' + folder.id
  };
}

// ── Upload file via multipart REST API ───────────
async function uploadFileToDrive(fileBuffer, fileName, mimeType, folderId) {
  const token = await getAccessToken();
  const fileMime = mimeType || 'application/octet-stream';

  // Build multipart body manually
  const boundary = '-------ITARC_BOUNDARY_' + Date.now();
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

  const bodyParts = [
    '--' + boundary + '\r\n',
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadata + '\r\n',
    '--' + boundary + '\r\n',
    'Content-Type: ' + fileMime + '\r\n\r\n'
  ];

  const pre = Buffer.from(bodyParts.join(''));
  const post = Buffer.from('\r\n--' + boundary + '--');
  const body = Buffer.concat([pre, fileBuffer, post]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary,
        'Content-Length': String(body.length)
      },
      body: body
    }
  );

  const uploaded = await res.json();
  if (uploaded.error) throw new Error('Upload failed: ' + uploaded.error.message);
  return { id: uploaded.id, name: uploaded.name, webViewLink: uploaded.webViewLink };
}

// ── Counsellor alert email ────────────────────────
async function sendCounsellorAlert(student, folderLink, uploadedFiles) {
  const fileList = uploadedFiles.map(f => '<li>' + f.name + '</li>').join('');
  await sgMail.send({
    to: process.env.COUNSELLOR_EMAIL,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Document System' },
    subject: 'New documents from ' + student.name + ' — ' + student.country,
    html: '<h2>New Student Documents</h2><p><b>' + student.name + '</b> (' + student.phone + ')</p><p>Country: ' + student.country + ' | Level: ' + student.level + '</p><ul>' + fileList + '</ul><p><a href="' + folderLink + '">Open Google Drive Folder</a></p><p><a href="' + process.env.UPLOAD_PORTAL_URL + '/admin">Open Admin Dashboard</a></p>'
  });
}

// ── Student confirmation email ────────────────────
async function sendStudentConfirmation(student, folderLink) {
  await sgMail.send({
    to: student.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Counselling' },
    subject: 'Documents received — your ' + student.country + ' application',
    html: '<h2>Hi ' + student.name + '!</h2><p>We received your documents. Your counsellor will review them within 1-2 business days.</p><p><a href="' + folderLink + '">View your folder</a></p>'
  });
}

// ── Multer config ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════

// ── TEST DRIVE (diagnostic) ───────────────────────
app.get('/test-drive', async (req, res) => {
  const results = {};
  try {
    results.step1 = 'Getting token...';
    const token = await getAccessToken();
    results.step1 = 'Token OK: ' + token.substring(0, 20) + '...';
    results.parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    results.step2 = 'Creating test folder...';
    const folderRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name',
      {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TEST-DELETE-ME-' + Date.now(),
          mimeType: 'application/vnd.google-apps.folder',
          parents: [process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID]
        })
      }
    );
    const folder = await folderRes.json();
    if (folder.error) throw new Error('Folder error: ' + folder.error.message);
    results.step2 = 'Folder OK: ' + folder.id;

    results.step3 = 'Uploading test file (multipart)...';
    const buf = Buffer.from('hello itarc test');
    const boundary = 'TESTBOUNDARY123';
    const meta = JSON.stringify({ name: 'test.txt', parents: [folder.id] });
    const pre = Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + boundary + '\r\nContent-Type: text/plain\r\n\r\n');
    const post = Buffer.from('\r\n--' + boundary + '--');
    const body = Buffer.concat([pre, buf, post]);
    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'multipart/related; boundary=' + boundary,
          'Content-Length': String(body.length)
        },
        body: body
      }
    );
    const uploaded = await uploadRes.json();
    if (uploaded.error) throw new Error('Upload error: ' + uploaded.error.message);
    results.step3 = 'File OK: ' + uploaded.id;

    res.json({ success: true, message: 'ALL STEPS PASSED — Google Drive is working!', results });
  } catch (e) {
    results.error = e.message;
    res.json({ success: false, results });
  }
});

// ── POST /api/upload ──────────────────────────────
app.post('/api/upload', upload.array('documents', 15), async (req, res) => {
  try {
    const { studentName, phone, email, country, level, course, counsellor, intake } = req.body;

    if (!studentName || !phone || !email || !country) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Duplicate guard
    const recentDuplicate = STUDENTS.find(s =>
      s.email === email && s.name === studentName &&
      (new Date() - new Date(s.createdAt)) < 30000
    );
    if (recentDuplicate) {
      return res.json({ success: true, folderLink: recentDuplicate.folderLink, studentId: recentDuplicate.id });
    }

    // Create student folder
    const { folderId, folderName, folderLink } = await createStudentFolder(studentName, country, level, course);

    // Upload each file
    const uploadedFiles = [];
    for (const file of req.files) {
      const uploaded = await uploadFileToDrive(file.buffer, file.originalname, file.mimetype, folderId);
      uploadedFiles.push({ name: file.originalname, driveId: uploaded.id, link: uploaded.webViewLink });
    }

    // Save student record
    const uploadToken = crypto.randomBytes(20).toString('hex');
    const student = {
      id: crypto.randomUUID(),
      name: studentName, phone, email, country,
      level: level || 'Not specified',
      course: course || 'Not specified',
      counsellor: counsellor || 'Unassigned',
      intake: intake || 'TBD',
      status: 'review',
      uploadedFiles, folderId, folderLink, folderName,
      uploadToken, reminderCount: 0, lastReminderSentAt: null,
      createdAt: new Date().toISOString(), approvedAt: null
    };
    STUDENTS.push(student);

    // Send alerts
    Promise.all([
      sendCounsellorAlert(student, folderLink, uploadedFiles),
      sendStudentConfirmation(student, folderLink)
    ]).catch(err => console.error('Email error:', err.message));

    res.json({ success: true, message: 'Documents uploaded!', folderLink, studentId: student.id });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/students ───────────────────────
app.get('/api/admin/students', (req, res) => {
  res.json({ students: STUDENTS });
});

// ── GET /api/admin/stats ──────────────────────────
app.get('/api/admin/stats', (req, res) => {
  res.json({
    total:      STUDENTS.length,
    pending:    STUDENTS.filter(s => s.status === 'pending').length,
    review:     STUDENTS.filter(s => s.status === 'review').length,
    approved:   STUDENTS.filter(s => s.status === 'approved').length,
    processing: STUDENTS.filter(s => s.status === 'processing').length,
  });
});

// ── POST /api/admin/approve/:id ───────────────────
app.post('/api/admin/approve/:id', async (req, res) => {
  const student = STUDENTS.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  student.status = 'approved';
  student.approvedAt = new Date().toISOString();
  try {
    await sgMail.send({
      to: student.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Counselling' },
      subject: 'Documents Approved — your ' + student.country + ' application moves forward!',
      html: '<h2>Great news ' + student.name + '!</h2><p>Your documents have been approved. We will begin your applications within 48 hours.</p>'
    });
  } catch(e) { console.warn('Approve email failed:', e.message); }
  res.json({ success: true, student });
});

// ── POST /api/admin/reject/:id ────────────────────
app.post('/api/admin/reject/:id', async (req, res) => {
  const student = STUDENTS.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  student.status = 'pending';
  const { reason, requestedDocs } = req.body;
  const reUploadLink = (process.env.UPLOAD_PORTAL_URL || '') + '/upload?token=' + student.uploadToken;
  try {
    await sgMail.send({
      to: student.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Counselling' },
      subject: 'Re-upload required — your ' + student.country + ' application',
      html: '<h2>Hi ' + student.name + '</h2><p>Some documents need attention.</p>' + (reason ? '<p><b>Reason:</b> ' + reason + '</p>' : '') + '<p><a href="' + reUploadLink + '">Re-upload Documents</a></p>'
    });
  } catch(e) { console.warn('Reject email failed:', e.message); }
  res.json({ success: true });
});

// ── POST /api/admin/remind/:id ────────────────────
app.post('/api/admin/remind/:id', async (req, res) => {
  const student = STUDENTS.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  student.lastReminderSentAt = new Date().toISOString();
  student.reminderCount = (student.reminderCount || 0) + 1;
  try {
    const uploadLink = (process.env.UPLOAD_PORTAL_URL || '') + '/upload?token=' + student.uploadToken;
    await sgMail.send({
      to: student.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Counselling' },
      subject: 'Reminder: documents pending — your ' + student.country + ' application',
      html: '<p>Hi ' + student.name + ', please upload your remaining documents: <a href="' + uploadLink + '">Upload here</a></p>'
    });
  } catch(e) { console.warn('Reminder email failed:', e.message); }
  res.json({ success: true, reminderCount: student.reminderCount });
});

// ── POST /api/admin/remind-all ────────────────────
app.post('/api/admin/remind-all', async (req, res) => {
  const pending = STUDENTS.filter(s => s.status === 'pending');
  for (const s of pending) {
    s.lastReminderSentAt = new Date().toISOString();
    s.reminderCount = (s.reminderCount || 0) + 1;
  }
  res.json({ success: true, sent: pending.length });
});

// ── POST /api/admin/add-student ───────────────────
app.post('/api/admin/add-student', (req, res) => {
  const { name, phone, email, country, level, course } = req.body;
  const uploadToken = crypto.randomBytes(20).toString('hex');
  const student = {
    id: crypto.randomUUID(), name, phone, email, country,
    level: level || 'Not specified', course: course || 'Not specified',
    status: 'pending', uploadedFiles: [], folderId: null, folderLink: null,
    uploadToken, reminderCount: 0, lastReminderSentAt: null,
    createdAt: new Date().toISOString()
  };
  STUDENTS.push(student);
  const uploadLink = (process.env.UPLOAD_PORTAL_URL || '') + '/upload?token=' + uploadToken;
  res.json({ success: true, student, uploadLink });
});

// ── Static pages ──────────────────────────────────
app.get('/upload', (req, res) => res.sendFile(path.join(__dirname, 'public', 'upload.html')));
app.get('/admin',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── SPA routes — all return index.html, JS handles display ──
const spaRoutes = [
  '/study-abroad', '/visa', '/education-loan', '/travel',
  '/counselling', '/compare',
  '/study/:country',
  '/guides/ireland', '/guides/germany', '/guides/canada',
  '/guides/uk', '/guides/visa-checklist', '/guides/ielts'
];
spaRoutes.forEach(route => {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Start ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('ITARC server running on port ' + PORT);
  try { require('./reminder-system'); } catch(e) { console.log('Reminder system not loaded:', e.message); }
});
