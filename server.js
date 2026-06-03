// ════════════════════════════════════════════════
// ITARC SERVER — server.js
// Node.js / Express backend
// Deploy on Render.com (free tier)
// ════════════════════════════════════════════════

require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const path     = require('path');
const { google } = require('googleapis');
const stream   = require('stream');
const sgMail   = require('@sendgrid/mail');
const crypto   = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // serves your website files

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ────────────────────────────────────────────────
// IN-MEMORY STORE (replace with MongoDB / Postgres)
// ────────────────────────────────────────────────
// In production, swap every `STUDENTS` read/write
// with real DB queries.  The shape is the same.

const STUDENTS = []; // { id, name, phone, email, country, level, course,
                     //   counsellor, intake, status, docs, folderId,
                     //   folderLink, uploadToken, reminderCount,
                     //   lastReminderSentAt, createdAt }

// ────────────────────────────────────────────────
// GOOGLE DRIVE HELPERS
// ────────────────────────────────────────────────

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  return google.drive({ version: 'v3', auth });
}

async function createStudentFolder(drive, studentName, country, level, course) {
  const year = new Date().getFullYear();
  const safeName = studentName.replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/\s+/g,'-');
  const safeCountry = country.replace(/\s+/g,'-');
  const levelShort = { "Bachelor's":'BSc', "Master's":'MS', "MBA":'MBA', "PhD":'PhD' }[level] || level;
  const folderName = `${year}-${safeName}-${safeCountry}-${levelShort}`;

  // Step 1: Create folder WITHOUT parents (avoids service account quota error)
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id,name'
  });

  // Step 2: Move the folder into the shared parent using update (not create)
  await drive.files.update({
    fileId: folder.data.id,
    addParents: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID,
    removeParents: 'root',
    supportsAllDrives: true,
    fields: 'id,parents'
  });

  // Step 3: Make folder readable by anyone with the link
  await drive.permissions.create({
    fileId: folder.data.id,
    requestBody: { role: 'reader', type: 'anyone' }
  });

  return {
    folderId: folder.data.id,
    folderName,
    folderLink: `https://drive.google.com/drive/folders/${folder.data.id}`
  };
}

async function uploadFileToDrive(drive, fileBuffer, fileName, mimeType, folderId) {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileBuffer);

  // Upload to service account root first (avoids storage quota error)
  const uploaded = await drive.files.create({
    requestBody: { name: fileName },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: bufferStream
    },
    fields: 'id,name,webViewLink'
  });

  // Then move into the shared student folder
  await drive.files.update({
    fileId: uploaded.data.id,
    addParents: folderId,
    removeParents: 'root',
    supportsAllDrives: true,
    fields: 'id,parents'
  });

  return uploaded.data;
}

// ────────────────────────────────────────────────
// EMAIL HELPERS
// ────────────────────────────────────────────────

async function sendCounsellorAlert({ student, folderLink, uploadedFiles }) {
  const fileList = uploadedFiles.map(f =>
    `<li style="margin-bottom:6px;font-size:13px"><strong>${f.name}</strong></li>`
  ).join('');

  await sgMail.send({
    to:      process.env.COUNSELLOR_EMAIL,
    from:    { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Document System' },
    subject: `📥 New documents from ${student.name} — ${student.country} ${student.level}`,
    html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#0b1f3a,#2563eb);padding:24px 32px">
    <div style="font-size:20px;font-weight:800;color:white">📥 New Student Documents</div>
    <div style="font-size:13px;color:rgba(255,255,255,.6);margin-top:4px">ITARC Document Management System</div>
  </div>
  <div style="padding:24px 32px">
    <p style="font-size:15px;font-weight:600;color:#0b1f3a;margin-bottom:16px">New submission received — action required</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:120px">Student</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:#0b1f3a">${student.name}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#64748b">Phone</td><td style="padding:8px 0;font-size:13px;font-weight:600">${student.phone}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#64748b">Email</td><td style="padding:8px 0;font-size:13px;font-weight:600">${student.email}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#64748b">Destination</td><td style="padding:8px 0;font-size:13px;font-weight:600">${student.country}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#64748b">Level</td><td style="padding:8px 0;font-size:13px;font-weight:600">${student.level}</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#64748b">Course</td><td style="padding:8px 0;font-size:13px;font-weight:600">${student.course || 'Not specified'}</td></tr>
    </table>
    <div style="background:#f8fafc;border-radius:10px;padding:14px 18px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:800;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">📎 Files Uploaded (${uploadedFiles.length})</div>
      <ul style="margin:0;padding-left:18px">${fileList}</ul>
    </div>
    <div style="text-align:center">
      <a href="${folderLink}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:700;margin-bottom:10px">
        📁 Open Google Drive Folder
      </a>
      <div style="margin-top:8px">
        <a href="${process.env.UPLOAD_PORTAL_URL}/admin" style="font-size:12.5px;color:#2563eb;text-decoration:none;font-weight:600">Open Admin Dashboard →</a>
      </div>
    </div>
  </div>
</div>
</div>`
  });
}

async function sendStudentConfirmation(student, folderLink) {
  await sgMail.send({
    to:   student.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Counselling' },
    subject: `✅ Documents received — your ${student.country} application`,
    html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:14px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#0b1f3a,#2563eb);padding:24px 32px">
    <div style="font-size:20px;font-weight:800;color:white">ITARC</div>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:16px;font-weight:700;color:#0b1f3a">Hi ${student.name}! 👋</p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:12px 0">
      We've received your documents for your <strong>${student.country} ${student.level}</strong> application. 
      Your counsellor will review them within <strong>1–2 business days</strong> and contact you with next steps.
    </p>
    <div style="background:#ecfdf5;border-radius:10px;padding:14px 18px;margin:20px 0">
      <div style="font-size:13px;font-weight:700;color:#065f46">✅ What happens next:</div>
      <ol style="margin:8px 0 0;padding-left:18px;font-size:13px;color:#475569;line-height:2">
        <li>Counsellor reviews each document</li>
        <li>You'll receive approval or re-upload request via WhatsApp + email</li>
        <li>Once approved — university applications begin within 48 hours</li>
      </ol>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${folderLink}" style="display:inline-block;background:#eff6ff;color:#2563eb;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;border:1.5px solid #bfdbfe">
        📁 View Your Document Folder
      </a>
    </div>
    <p style="font-size:13px;color:#475569">Questions? WhatsApp us: <strong>${process.env.COUNSELLOR_PHONE || '+91 84549 92179'}</strong></p>
  </div>
</div>
</div>`
  });
}

// ────────────────────────────────────────────────
// MULTER CONFIG
// ────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.jpg','.jpeg','.png','.doc','.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// ────────────────────────────────────────────────
// ROUTES
// ────────────────────────────────────────────────

// ── POST /api/upload ─────────────────────────────
// Student submits their documents
app.post('/api/upload', upload.array('documents', 15), async (req, res) => {
  try {
    const { studentName, phone, email, country, level, course, counsellor, intake } = req.body;

    if (!studentName || !phone || !email || !country) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Duplicate submission guard — prevent double-submit within 30 seconds
    const recentDuplicate = STUDENTS.find(s =>
      s.email === email &&
      s.name === studentName &&
      (new Date() - new Date(s.createdAt)) < 30000
    );
    if (recentDuplicate) {
      return res.json({ success: true, message: 'Already submitted', folderLink: recentDuplicate.folderLink, studentId: recentDuplicate.id });
    }

    // 1. Connect to Google Drive
    const drive = getDriveClient();

    // 2. Create student folder
    const { folderId, folderName, folderLink } = await createStudentFolder(
      drive, studentName, country, level, course
    );

    // 3. Upload each file into the folder
    const uploadedFiles = [];
    for (const file of req.files) {
      const uploaded = await uploadFileToDrive(
        drive, file.buffer, file.originalname, file.mimetype, folderId
      );
      uploadedFiles.push({ name: file.originalname, driveId: uploaded.id, link: uploaded.webViewLink });
    }

    // 4. Build doc status list (what's uploaded vs pending)
    const knownDocIds = ['passport','degree','ielts','sop','lor','cv','bank'];
    const docs = knownDocIds.map(id => ({
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g,' '),
      status: 'pending', // will be updated when files are matched by name
      required: true
    }));

    // 5. Save student record
    const uploadToken = crypto.randomBytes(20).toString('hex');
    const student = {
      id: crypto.randomUUID(),
      name: studentName, phone, email, country, level,
      course: course || 'Not specified',
      counsellor: counsellor || 'Unassigned',
      intake: intake || 'TBD',
      status: 'review',
      docs,
      uploadedFiles,
      folderId,
      folderLink,
      folderName,
      uploadToken,
      reminderCount: 0,
      lastReminderSentAt: null,
      createdAt: new Date().toISOString(),
      approvedAt: null,
      notes: ''
    };
    STUDENTS.push(student);

    // 6. Send alerts (non-blocking)
    Promise.all([
      sendCounsellorAlert({ student, folderLink, uploadedFiles }),
      sendStudentConfirmation(student, folderLink)
    ]).catch(err => console.error('Email error:', err.message));

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      folderLink,
      folderName,
      studentId: student.id
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/students ──────────────────────
app.get('/api/admin/students', (req, res) => {
  // In production: add auth middleware here
  res.json({ students: STUDENTS });
});

// ── POST /api/admin/approve/:id ──────────────────
app.post('/api/admin/approve/:id', async (req, res) => {
  const student = STUDENTS.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  student.status = 'approved';
  student.approvedAt = new Date().toISOString();
  const { nextStep } = req.body;

  // Move folder to Approved subfolder on Drive
  try {
    const drive = getDriveClient();
    const approvedFolderId = process.env.GOOGLE_DRIVE_APPROVED_FOLDER_ID;
    if (approvedFolderId) {
      await drive.files.update({
        fileId: student.folderId,
        addParents: approvedFolderId,
        removeParents: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
      });
    }
  } catch(e) { console.warn('Drive move failed:', e.message); }

  // Email student
  try {
    await sgMail.send({
      to:   student.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Counselling' },
      subject: `🎉 Documents Approved — your ${student.country} application moves forward!`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:600px">
        <h2 style="color:#059669">✅ Your documents have been approved!</h2>
        <p>Hi ${student.name}, great news — your counsellor has reviewed and approved all your documents.</p>
        <p>We will now begin your <strong>${nextStep === 'visa' ? 'visa filing' : nextStep === 'loan' ? 'loan processing' : 'university applications'}</strong> within 48 hours.</p>
        <p>Your counsellor will be in touch on WhatsApp shortly.</p>
        <p>— ITARC Team</p>
      </div>`
    });
  } catch(e) { console.warn('Approval email failed:', e.message); }

  res.json({ success: true, student });
});

// ── POST /api/admin/reject/:id ───────────────────
app.post('/api/admin/reject/:id', async (req, res) => {
  const student = STUDENTS.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  student.status = 'pending';
  const { reason, requestedDocs } = req.body;

  const reUploadLink = `${process.env.UPLOAD_PORTAL_URL}/upload?token=${student.uploadToken}`;

  try {
    await sgMail.send({
      to:   student.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Counselling' },
      subject: `📋 Re-upload required — your ${student.country} application`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:600px">
        <h2 style="color:#d97706">⚠️ Some documents need attention</h2>
        <p>Hi ${student.name}, we've reviewed your documents and need a few corrections.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        ${requestedDocs ? `<p><strong>Please re-upload:</strong> ${requestedDocs}</p>` : ''}
        <a href="${reUploadLink}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
          📎 Re-upload Documents
        </a>
        <p style="margin-top:16px">Questions? WhatsApp: ${process.env.COUNSELLOR_PHONE}</p>
      </div>`
    });
  } catch(e) { console.warn('Reject email failed:', e.message); }

  res.json({ success: true });
});

// ── POST /api/admin/remind/:id ───────────────────
app.post('/api/admin/remind/:id', async (req, res) => {
  const student = STUDENTS.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Import and call reminder system
  const { sendReminderToStudent } = require('./reminder-system');
  await sendReminderToStudent(student);

  student.lastReminderSentAt = new Date().toISOString();
  student.reminderCount = (student.reminderCount || 0) + 1;

  res.json({ success: true, reminderCount: student.reminderCount });
});

// ── POST /api/admin/remind-all ───────────────────
app.post('/api/admin/remind-all', async (req, res) => {
  const pending = STUDENTS.filter(s => s.status === 'pending');
  const { sendReminderToStudent } = require('./reminder-system');
  let count = 0;
  for (const s of pending) {
    await sendReminderToStudent(s).catch(e => console.warn(e.message));
    s.lastReminderSentAt = new Date().toISOString();
    s.reminderCount = (s.reminderCount || 0) + 1;
    count++;
  }
  res.json({ success: true, sent: count });
});

// ── POST /api/admin/add-student ──────────────────
// Manually add a student from dashboard
app.post('/api/admin/add-student', (req, res) => {
  const { name, phone, email, country, level, course, counsellor } = req.body;
  const uploadToken = crypto.randomBytes(20).toString('hex');
  const student = {
    id: crypto.randomUUID(),
    name, phone, email, country, level, course: course || 'Not specified',
    counsellor: counsellor || 'Unassigned',
    intake: 'TBD', status: 'pending',
    docs: [], uploadedFiles: [],
    folderId: null, folderLink: null, folderName: null,
    uploadToken, reminderCount: 0, lastReminderSentAt: null,
    createdAt: new Date().toISOString(), approvedAt: null, notes: ''
  };
  STUDENTS.push(student);

  // Send welcome WhatsApp + email (optional)
  const uploadLink = `${process.env.UPLOAD_PORTAL_URL}/upload?token=${uploadToken}`;
  // sendWelcomeMessage(student, uploadLink); // uncomment when ready

  res.json({ success: true, student, uploadLink });
});

// ── GET /api/admin/stats ─────────────────────────
app.get('/api/admin/stats', (req, res) => {
  res.json({
    total:      STUDENTS.length,
    pending:    STUDENTS.filter(s => s.status === 'pending').length,
    review:     STUDENTS.filter(s => s.status === 'review').length,
    approved:   STUDENTS.filter(s => s.status === 'approved').length,
    processing: STUDENTS.filter(s => s.status === 'processing').length,
  });
});

// ── GET /test-drive ── diagnostic route ─────────
app.get('/test-drive', async (req, res) => {
  const results = {};
  try {
    // Test 1: Can we authenticate?
    results.step1 = 'Authenticating...';
    const drive = getDriveClient();
    results.step1 = 'Auth OK';

    // Test 2: Can we list files?
    results.step2 = 'Listing files...';
    const list = await drive.files.list({ pageSize: 1 });
    results.step2 = 'List OK';

    // Test 3: Can we create a file in root?
    results.step3 = 'Creating test file...';
    const f = await drive.files.create({
      requestBody: { name: 'itarc-test.txt' },
      media: { mimeType: 'text/plain', body: 'test' },
      fields: 'id'
    });
    results.step3 = 'Create OK — id: ' + f.data.id;

    // Test 4: Can we move it to the parent folder?
    results.step4 = 'Moving to parent folder...';
    results.parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    await drive.files.update({
      fileId: f.data.id,
      addParents: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID,
      removeParents: 'root',
      supportsAllDrives: true,
      fields: 'id,parents'
    });
    results.step4 = 'Move OK';

    // Test 5: Delete the test file
    await drive.files.delete({ fileId: f.data.id });
    results.step5 = 'Cleanup OK';

    res.json({ success: true, results });
  } catch(e) {
    results.error = e.message;
    results.errorCode = e.code;
    results.errorDetails = e.errors;
    res.json({ success: false, results });
  }
});

// Serve upload portal
app.get('/upload', (req, res) => res.sendFile(path.join(__dirname, 'public', 'upload.html')));
// Serve admin dashboard
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
// Serve main website
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ────────────────────────────────────────────────
// START
// ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ITARC server running on port ${PORT}`);

  // Start reminder cron
  require('./reminder-system');
});
