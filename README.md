# ITARC — Google Drive Document System
## Complete Setup Guide (20 minutes)

---

## What You're Getting

When a student submits documents on your website:

```
ITARC Students/
└── 2025-Arjun-Desai-Germany-MS/
    ├── passport.pdf
    ├── degree_certificate.pdf
    ├── ielts_scorecard.pdf
    └── bank_statement.pdf
```

- **Student portal** at `yoursite.com/upload` — students fill details + upload files
- **Google Drive** — auto-creates a named folder per student with their files
- **Email alerts** — counsellor gets an instant email with a link to the Drive folder
- **Admin dashboard** at `yoursite.com/admin` — approve / reject / remind students
- **Auto reminders** — daily cron at 10 AM IST, WhatsApp + email, 48h cooldown, escalates after 5 attempts

---

## Files in This Package

| File | Purpose |
|------|---------|
| `server.js` | Main Node.js/Express backend — all API routes |
| `reminder-system.js` | Cron job + WhatsApp/email reminder logic |
| `upload.html` | Student-facing upload portal |
| `admin.html` | Counsellor dashboard |
| `package.json` | Node.js dependencies |
| `.env.example` | Environment variables template |

---

## Step 1 — Google Drive Setup (10 min)

### 1a. Create the Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project** → name it `itarc-website` → Create
3. In the search bar, search **"Google Drive API"** → Enable it

### 1b. Create a Service Account

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → Service Account**
3. Name: `itarc-drive-uploader` → Create
4. Click the service account → **Keys** tab → **Add Key → JSON**
5. A `.json` file downloads — keep it safe, you'll paste it into Render

### 1c. Set up Google Drive folders

1. Open [drive.google.com](https://drive.google.com)
2. Create a folder called **"ITARC Students"** (for new uploads)
3. Create a folder called **"ITARC Approved"** (for approved students)
4. Right-click each folder → **Share** → enter the service account email
   (it looks like `itarc-drive-uploader@itarc-website.iam.gserviceaccount.com`) → Role: **Editor**
5. Get each folder's ID from the URL:
   `https://drive.google.com/drive/folders/` **`1aBcDeFgHiJkLmNoPqRsTuVwXyZ`**

---

## Step 2 — SendGrid (email, 5 min)

1. Sign up at [sendgrid.com](https://sendgrid.com) (free: 100 emails/day)
2. Settings → API Keys → Create API Key (Full Access)
3. Save the key (starts with `SG.`)
4. Settings → Sender Authentication → verify your sending domain or email

---

## Step 3 — Twilio WhatsApp (optional, 5 min)

1. Sign up at [twilio.com](https://twilio.com)
2. For testing: Messaging → Try it out → WhatsApp (sandbox)
3. For production: apply for WhatsApp Business number (~$0.50/message)
4. Note your Account SID and Auth Token from the dashboard

---

## Step 4 — Deploy on Render

### 4a. Add files to your GitHub repo

Copy these files into your existing repo:
- `server.js` → root
- `reminder-system.js` → root  
- `package.json` → root
- `upload.html` → `public/upload.html`
- `admin.html` → `public/admin.html`
- Your existing `index.html` → `public/index.html`

### 4b. Environment Variables on Render

Go to your Render service → **Environment** tab → Add these:

```
GOOGLE_SERVICE_ACCOUNT_JSON    ← paste the entire contents of the .json key file (one line)
GOOGLE_DRIVE_PARENT_FOLDER_ID  ← ID of "ITARC Students" folder
GOOGLE_DRIVE_APPROVED_FOLDER_ID ← ID of "ITARC Approved" folder
SENDGRID_API_KEY               ← starts with SG.
SENDGRID_FROM_EMAIL            ← your verified sending email
COUNSELLOR_EMAIL               ← where counsellor alerts go
COUNSELLOR_PHONE               ← +91XXXXXXXXXX
TWILIO_ACCOUNT_SID             ← from Twilio dashboard
TWILIO_AUTH_TOKEN              ← from Twilio dashboard
TWILIO_WHATSAPP_NUMBER         ← your Twilio WhatsApp number
UPLOAD_PORTAL_URL              ← https://itarcwebsiteflygrad.onrender.com
```

### 4c. Build & Start commands on Render

- **Build command:** `npm install`
- **Start command:** `node server.js`

---

## Step 5 — Test it

1. Open `yoursite.com/upload`
2. Fill in a test student with your email + WhatsApp number
3. Upload a test PDF
4. Check that:
   - ✅ A folder appears in Google Drive ("ITARC Students")
   - ✅ You receive a counsellor alert email
   - ✅ The "student" receives a confirmation email
5. Open `yoursite.com/admin`
6. The test student should appear — click Approve or Remind

---

## Adding a "Submit Documents" Link to Your Main Website

Add this button anywhere on your `index.html`:

```html
<a href="/upload" class="btn-free" style="background:#059669">
  📎 Submit My Documents
</a>
```

Or as a tab in your existing nav bar — just add it to the tab-bar section.

---

## URL Summary

| URL | Who uses it |
|-----|------------|
| `yoursite.com/` | Public website |
| `yoursite.com/upload` | Students upload documents |
| `yoursite.com/admin` | Counsellors review & approve |

---

## Production Checklist

- [ ] Google Cloud project created, Drive API enabled
- [ ] Service account JSON key downloaded
- [ ] "ITARC Students" folder created and shared with service account
- [ ] "ITARC Approved" folder created and shared
- [ ] SendGrid account set up, email domain verified
- [ ] All env vars added to Render
- [ ] Test upload working end-to-end
- [ ] Admin dashboard accessible at /admin
- [ ] (Optional) Password-protect /admin with basic auth middleware

---

## Questions?

WhatsApp ITARC: +91 84549 92179
