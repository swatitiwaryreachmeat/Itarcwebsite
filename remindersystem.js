// ════════════════════════════════════════════════
// ITARC AUTOMATED REMINDER SYSTEM
// reminder-system.js
// Runs on your Node.js server — handles WhatsApp + Email reminders
// ════════════════════════════════════════════════

const cron   = require('node-cron');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');

// ── Clients ──────────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ── In-memory DB placeholder ──────────────────────
// Replace with your real database (MongoDB, Postgres, etc.)
// Each student object shape:
// {
//   id, name, phone, email, country, course, level,
//   counsellorName, counsellorPhone,
//   docs: [ { name, status:'uploaded'|'pending', required:true } ],
//   status: 'pending'|'review'|'approved'|'processing',
//   createdAt, lastReminderSentAt, reminderCount,
//   uploadToken,  // unique token for their upload link
//   nextStep      // 'university_app'|'visa'|'loan'
// }

// ── Next step descriptions ─────────────────────────
const NEXT_STEP_TEXT = {
  university_app: {
    short: 'university application submission',
    detail: [
      '📋 Counsellor reviews and approves your documents (1–2 business days)',
      '🏫 University shortlist shared with you for confirmation',
      '📝 Application forms submitted to your chosen universities',
      '📬 Offer letters collected and reviewed with you',
      '✅ Acceptance confirmed — move to visa stage',
    ]
  },
  visa: {
    short: 'student visa filing',
    detail: [
      '📋 Counsellor reviews and approves your documents (1–2 business days)',
      '🛂 Visa application package prepared by our team',
      '🏦 Financial document verification (blocked account / GIC)',
      '🗓️ Embassy appointment scheduled',
      '✈️ Visa approved — pre-departure briefing',
    ]
  },
  loan: {
    short: 'education loan processing',
    detail: [
      '📋 Counsellor reviews and approves your documents (1–2 business days)',
      '🏦 Best loan options shared with you',
      '📁 Loan application submitted to bank',
      '✅ Sanction letter received',
      '💰 Funds disbursed to university',
    ]
  }
};

// ── WhatsApp Message Builder ───────────────────────
function buildWhatsAppMessage(student) {
  const missing = student.docs.filter(d => d.status === 'pending' && d.required);
  const uploaded = student.docs.filter(d => d.status === 'uploaded');
  const nextStepInfo = NEXT_STEP_TEXT[student.nextStep || 'university_app'];
  const uploadUrl = `${process.env.UPLOAD_PORTAL_URL}?token=${student.uploadToken}`;

  return `Hi ${student.name} 👋

This is a reminder from *ITARC* regarding your application to study *${student.course}* in *${student.country}*.

Your counsellor *${student.counsellorName}* is ready to move forward — we just need a few more documents from you.

*📋 Document Status:*
${uploaded.map(d => `✅ ${d.name}`).join('\n')}
${missing.map(d => `❌ ${d.name} — *still missing*`).join('\n')}

*📎 Upload here:*
${uploadUrl}

*⏭️ Once approved, we will begin your ${nextStepInfo.short} within 48 hours.*

Questions? Reply to this message or call us:
📞 ${student.counsellorPhone || process.env.COUNSELLOR_PHONE}

— ITARC Team`;
}

// ── Email Builder ──────────────────────────────────
function buildEmail(student) {
  const missing = student.docs.filter(d => d.status === 'pending' && d.required);
  const uploaded = student.docs.filter(d => d.status === 'uploaded');
  const nextStepInfo = NEXT_STEP_TEXT[student.nextStep || 'university_app'];
  const uploadUrl = `${process.env.UPLOAD_PORTAL_URL}?token=${student.uploadToken}`;

  const uploadedHTML = uploaded.map(d =>
    `<tr><td style="padding:8px 14px;font-size:13px;background:#ecfdf5;border-radius:6px;margin-bottom:4px;display:block">
      ✅ <span style="font-weight:600;color:#065f46">${d.name}</span>
    </td></tr>`
  ).join('');

  const missingHTML = missing.map(d =>
    `<tr><td style="padding:8px 14px;font-size:13px;background:#fef2f2;border-radius:6px;margin-bottom:4px;display:block;border-left:3px solid #dc2626">
      ❌ <span style="font-weight:700;color:#991b1b">${d.name}</span> — please upload ASAP
    </td></tr>`
  ).join('');

  const nextStepsHTML = nextStepInfo.detail.map((s, i) =>
    `<li style="margin-bottom:8px;font-size:13px;color:#475569">${s}</li>`
  ).join('');

  const subject = missing.length > 0
    ? `Action required: ${missing.length} document${missing.length>1?'s':''} pending — your ${student.country} application`
    : `Your documents are under review — ${student.country} application update`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0b1f3a,#2563eb);padding:28px 32px">
    <div style="font-size:22px;font-weight:800;color:white;letter-spacing:-.5px">ITARC</div>
    <div style="font-size:13px;color:rgba(255,255,255,.65);margin-top:4px">Study Abroad Consultants</div>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px">
    <p style="font-size:16px;font-weight:600;color:#0b1f3a;margin-bottom:8px">Dear ${student.name},</p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin-bottom:20px">
      We hope you're excited about your upcoming studies in <strong>${student.country}</strong>!
      Your ITARC counsellor <strong>${student.counsellorName}</strong> has reviewed your profile
      and is ready to move forward — we just need a few more documents from you.
    </p>

    <!-- Doc status -->
    <div style="background:#f8fafc;border-radius:10px;padding:18px;margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">📋 Your Document Status</div>
      <table style="width:100%;border-collapse:separate;border-spacing:0 4px">
        ${uploadedHTML}
        ${missingHTML}
      </table>
    </div>

    <!-- Upload CTA -->
    <div style="text-align:center;margin:24px 0">
      <a href="${uploadUrl}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700">
        📎 Upload Your Documents Now
      </a>
      <div style="font-size:12px;color:#94a3b8;margin-top:8px">Secure upload · Takes 2 minutes</div>
    </div>

    <!-- Next steps -->
    <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:8px">
      <div style="font-size:13px;font-weight:700;color:#0b1f3a;margin-bottom:10px">⏭️ What happens next (after your documents are approved):</div>
      <ol style="padding-left:20px;margin:0">${nextStepsHTML}</ol>
    </div>

    <!-- Contact -->
    <div style="background:#eff6ff;border-radius:10px;padding:16px;margin-top:20px">
      <div style="font-size:13px;color:#1d4ed8;font-weight:700;margin-bottom:4px">💬 Have questions?</div>
      <div style="font-size:13px;color:#3b82f6">
        WhatsApp us: <strong>${student.counsellorPhone}</strong> · 
        Email: <strong>${process.env.COUNSELLOR_EMAIL}</strong>
      </div>
    </div>

    <p style="font-size:13px;color:#475569;margin-top:20px;line-height:1.6">
      Warm regards,<br>
      <strong>${student.counsellorName}</strong><br>
      Senior Counsellor — ITARC<br>
      📞 ${student.counsellorPhone}
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;text-align:center;font-size:11.5px;color:#94a3b8">
    ITARC Business · India's trusted study abroad consultants
    <br>To stop receiving these reminders, <a href="#" style="color:#94a3b8">click here</a>
  </div>
</div>
</body>
</html>`;

  return { subject, html };
}

// ── Send WhatsApp via Twilio ───────────────────────
async function sendWhatsApp(student) {
  try {
    const message = buildWhatsAppMessage(student);
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to:   `whatsapp:${student.phone}`,
      body: message
    });
    console.log(`✅ WhatsApp sent to ${student.name} (${student.phone})`);
    return true;
  } catch (err) {
    console.error(`❌ WhatsApp failed for ${student.name}:`, err.message);
    return false;
  }
}

// ── Send Email via SendGrid ────────────────────────
async function sendEmail(student) {
  try {
    const { subject, html } = buildEmail(student);
    await sgMail.send({
      to:      student.email,
      from:    { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC Counselling' },
      cc:      process.env.COUNSELLOR_EMAIL,
      subject,
      html
    });
    console.log(`✅ Email sent to ${student.name} (${student.email})`);
    return true;
  } catch (err) {
    console.error(`❌ Email failed for ${student.name}:`, err.message);
    return false;
  }
}

// ── Send both ─────────────────────────────────────
async function sendReminderToStudent(student) {
  const [wa, email] = await Promise.all([
    sendWhatsApp(student),
    sendEmail(student)
  ]);

  // Update reminder record in DB
  await updateStudentReminder(student.id, { wa, email });

  return { whatsapp: wa, email };
}

// ── DB update placeholder ──────────────────────────
async function updateStudentReminder(id, result) {
  // Replace with your real DB call e.g.:
  // await db.collection('students').updateOne(
  //   { _id: id },
  //   { $set: { lastReminderSentAt: new Date(), reminderCount: { $inc: 1 } } }
  // );
  console.log(`DB updated for student ${id}:`, result);
}

// ── Get pending students from DB ───────────────────
async function getPendingStudents() {
  // Replace with real DB query e.g.:
  // return await db.collection('students').find({
  //   status: 'pending',
  //   reminderCount: { $lt: 5 }
  // }).toArray();

  // Demo data for testing:
  return []; // return your real students here
}

// ════════════════════════════════════════════════
// SCHEDULED JOBS
// ════════════════════════════════════════════════

// Runs every day at 10:00 AM IST (04:30 UTC)
cron.schedule('30 4 * * *', async () => {
  console.log('🕐 Running daily reminder check...');

  const students = await getPendingStudents();
  const now = new Date();
  let sent = 0;

  for (const student of students) {
    const hasPendingDocs = student.docs.some(d => d.status === 'pending' && d.required);
    if (!hasPendingDocs) continue;

    // Skip if already reminded in last 2 days
    if (student.lastReminderSentAt) {
      const hoursSince = (now - new Date(student.lastReminderSentAt)) / 36e5;
      if (hoursSince < 48) continue;
    }

    // Stop after 5 reminders — escalate to counsellor instead
    if (student.reminderCount >= 5) {
      await notifyCounsellorEscalation(student);
      continue;
    }

    await sendReminderToStudent(student);
    sent++;
  }

  console.log(`✅ Daily reminders done — sent ${sent} reminders`);
}, { timezone: 'Asia/Kolkata' });

// Escalation: after 5 reminders with no response, alert counsellor
async function notifyCounsellorEscalation(student) {
  try {
    await sgMail.send({
      to:   process.env.COUNSELLOR_EMAIL,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'ITARC System' },
      subject: `⚠️ Escalation: ${student.name} — ${student.reminderCount} reminders sent with no response`,
      html: `<p>Student <strong>${student.name}</strong> (${student.phone}) has not uploaded their documents after <strong>${student.reminderCount} reminders</strong>.</p>
             <p>Please call them directly. Missing docs: ${student.docs.filter(d=>d.status==='pending').map(d=>d.name).join(', ')}</p>`
    });
    console.log(`⚠️ Escalation email sent for ${student.name}`);
  } catch(e) {
    console.error('Escalation email failed:', e.message);
  }
}

// ════════════════════════════════════════════════
// API ROUTES — add these to your server.js
// ════════════════════════════════════════════════

function registerReminderRoutes(app) {

  // Manual trigger: send reminder to one student
  app.post('/api/admin/remind/:studentId', async (req, res) => {
    try {
      // const student = await db.collection('students').findOne({ _id: req.params.studentId });
      // await sendReminderToStudent(student);
      res.json({ success: true, message: 'Reminder sent via WhatsApp & Email' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk reminder: all pending students
  app.post('/api/admin/remind-all', async (req, res) => {
    try {
      const students = await getPendingStudents();
      let count = 0;
      for (const s of students) {
        await sendReminderToStudent(s);
        count++;
      }
      res.json({ success: true, sent: count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Approve student — triggers "approved" email + moves to next stage
  app.post('/api/admin/approve/:studentId', async (req, res) => {
    try {
      const { nextStep } = req.body; // 'university_app' | 'visa' | 'loan'
      // await db.collection('students').updateOne({ _id: req.params.studentId }, { $set: { status: 'approved', nextStep } });
      // await sendApprovalNotification(student, nextStep);
      res.json({ success: true, message: 'Student approved and notified' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

}

module.exports = { sendReminderToStudent, registerReminderRoutes, sendWhatsApp, sendEmail };


