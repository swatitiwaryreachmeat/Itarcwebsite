
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', {
    page_title: document.title,
    page_location: window.location.href
  });
  // Track page views on single-page navigation
  window.trackPage = function(pageName) {
    gtag('event', 'page_view', {
      page_title: pageName,
      page_location: window.location.href + '#' + pageName
    });
  };


// ===== Flygrad MAIN NAVIGATION & UTILITIES =====

const PAGE_TITLES = {
  home:'Flygrad — Study Abroad Consultancy India | Ireland, UK, Germany, Canada, Australia, USA',
  education:'Study Abroad from India | Flygrad',
  immigration:'Immigration & Visa Solutions | Flygrad',
  financial:'Education Loan for Study Abroad India | Flygrad',
  it:'Cheap Flights from India to Europe & UK | Flygrad Travel',
  compare:'Compare Study Destinations | Flygrad',
  contact:'Book Free Study Abroad Counselling | Flygrad',
  'guide-ireland':'Study in Ireland from India 2025 — Complete Guide | Flygrad',
  'guide-germany':'Study in Germany Free 2025 — India Handbook | Flygrad',
  'guide-canada':'Study in Canada from India — PR & SDS Guide 2025 | Flygrad',
  'guide-uk':'UK Student Visa Guide for Indians 2025 | Flygrad',
  'guide-visa':'Student Visa Checklist 2025 — All Countries | Flygrad',
  'guide-ielts':'IELTS Score Requirements 2025 by Country | Flygrad'
};

const COUNTRY_TITLES = {
  germany:'Study in Germany from India | Flygrad',ireland:'Study in Ireland from India | Flygrad',
  uk:'Study in UK from India | Flygrad',canada:'Study in Canada from India | Flygrad',
  australia:'Study in Australia from India | Flygrad',usa:'Study in USA from India | Flygrad',
  france:'Study in France from India | Flygrad',netherlands:'Study in Netherlands from India | Flygrad',
  sweden:'Study in Sweden from India | Flygrad'
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) { page.classList.add('active'); }
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
  if (PAGE_TITLES[name]) document.title = PAGE_TITLES[name];
}

function showCountry(country) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const page = document.getElementById('page-country-' + country);
  if (page) { page.classList.add('active'); }
  window.scrollTo({top:0, behavior:'smooth'});
  if (COUNTRY_TITLES[country]) document.title = COUNTRY_TITLES[country];
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({behavior:'smooth', block:'start'});
  document.querySelectorAll('.cqn-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
}

function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('open');
}

function handleSubmit(e) {
  e.preventDefault();
  const notif = document.getElementById('notif');
  notif.textContent = '✓ Message sent! We will contact you within 24 hours.';
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 4000);
  e.target.reset();
}

function switchTicketTab(btn, type) {
  document.querySelectorAll('.ttab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

function handleTravelSearch() {
  const notif = document.getElementById('notif');
  notif.textContent = '✈️ Travel team notified! We will call you within 2 hours with the best fares.';
  notif.classList.add('show');
  setTimeout(() => {
    notif.classList.remove('show');
    notif.textContent = '✓ Message sent! We will contact you within 24 hours.';
  }, 5000);
}

// Country quick-nav intersection observer
const cqnObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      document.querySelectorAll('.cqn-btn').forEach(b => {
        const onclick = b.getAttribute('onclick') || '';
        b.classList.toggle('active', onclick.includes("'" + id + "'") || onclick.includes('"' + id + '"'));
      });
    }
  });
}, {threshold:0.4, rootMargin:'-80px 0px -40% 0px'});
document.querySelectorAll('[id^="de-"],[id^="ca-"],[id^="au-"],[id^="us-"],[id^="ie-"],[id^="uk-"]').forEach(el => cqnObserver.observe(el));



// API key is handled server-side for security — never put keys in frontend HTML


let agentOpen = false;
let agentHistory = [];

const AGENT_SYSTEM = "You are Flygrad's friendly AI study abroad advisor for Indian students. " +
"Flygrad is a Mumbai-based consultancy helping students study in Ireland, UK, Germany, Canada, Australia, USA & more. " +
"Key facts: " +
"Germany: tuition-free public universities (€300–700/yr), APS certificate required for Indians, block account €11208/yr, 18-month job seeker visa. " +
"Ireland: €10,000–25,000/yr (₹9.6–23.9L), 2-year post-study visa, English medium, UCD QS#171, Trinity QS#81. " +
"UK: 1-year Masters, Graduate Route 2-yr visa, IELTS 6.0-7.0. " +
"Canada: 3-year PGWP, Express Entry PR 2-3 yrs, SDS visa 20 days, IELTS 6.0+. " +
"Australia: Group of Eight, 2-4yr post-study visa, healthcare nursing PR. " +
"USA: STEM OPT 3 yrs, GRE required, highest salaries. " +
"Flygrad: free counselling, 99% visa success, 300+ students placed, +91 62915 27895. " +
"Be helpful, concise (2-3 paragraphs max), warm and professional. Always end with a CTA to book free counselling.";

// Smart FAQ fallback (works without API key)
const FAQ_ANSWERS = {
  "germany": "🇩🇪 Germany is incredible value! Public universities charge only €150–350 per semester — nearly zero tuition. You need an APS certificate (Flygrad helps with this), a blocked account of €11,208 (₹10.7L), and IELTS 6.5+. After graduation you get an 18-month job seeker visa. TU Munich, RWTH Aachen and Heidelberg are top picks for Indian students.\n\n📅 Want a personalised Germany plan? Book your free session below!",
  "ireland": "🇮🇪 Ireland is India's #1 European destination! English-medium education, Google/Meta/LinkedIn all headquartered in Dublin, and a 2-year post-study work permit. Tuition is €10,000–25,000/yr (₹9.6–23.9L). IELTS 6.0–6.5 required. UCD and Trinity are the top choices.\n\n📅 Book a free session and we'll build your Ireland shortlist!",
  "canada": "🇨🇦 Canada has the world's best PR pathway for students! Complete a 2-year degree → get a 3-year Post-Graduate Work Permit (PGWP) → 1 year work experience → Express Entry PR. The SDS visa fast-tracks approval in ~20 days. UofT, UBC and Waterloo are most popular with Indian students.\n\n📅 Book a free session to map your Canada PR pathway!",
  "uk": "🇬🇧 UK degrees are globally respected and most Masters are just 1 year — saving you a year of costs vs USA/Canada. After graduating you get the Graduate Route visa (2 years open work rights). Oxford, Cambridge, UCL and Manchester are top choices. IELTS 6.0–7.0 required.\n\n📅 Book your free UK counselling session today!",
  "australia": "🇦🇺 Australia's Group of Eight universities are world-class, and the post-study visa (Subclass 485) gives 2–4 years to work. Healthcare and nursing graduates get priority PR points. Minimum wage is AUD 23+/hr — students can work 48hrs/fortnight. Melbourne, UNSW Sydney and ANU are top picks.\n\n📅 Book a free session with our Australia specialist!",
  "usa": "🇺🇸 USA has MIT, Stanford, CMU — the world's top research unis. STEM graduates get a 3-year OPT extension to work. GRE is required for most MS programs. Starting salaries for CS graduates are $110,000–140,000/yr. The main challenge is the long Green Card wait for Indians.\n\n📅 Book a free session to plan your USA application strategy!",
  "ielts": "📝 IELTS score requirements by country:\n• Ireland: 6.0–6.5\n• UK: 6.0–7.0 (Russell Group: 6.5+)\n• Germany (English programs): 6.5\n• Canada (SDS): 6.0 each skill\n• Australia: 6.0–6.5 (Go8: 6.5+)\n• USA: 6.5–7.5 + GRE/GMAT\n\nA 6.5 overall score gives you access to most universities across all destinations!\n\n📅 Not sure if your score is enough? Book a free check with our counsellors!",
  "cost": "💰 Annual costs comparison for Indian students:\n• Germany: ₹8–12L (nearly free tuition!)\n• France: ₹10–15L\n• Ireland: ₹18–28L\n• Netherlands: ₹20–30L\n• UK: ₹25–45L\n• Canada: ₹28–48L\n• Australia: ₹30–50L\n• USA: ₹45–80L\n\nGermany gives the highest ROI by far! Book a free session for your personalised cost breakdown.",
  "visa": "🛂 Student visa timelines:\n• Germany: 8–12 weeks (book embassy early!)\n• Ireland: Stamp 2 — 3–6 weeks\n• UK: 3–4 weeks (fast-track available)\n• Canada SDS: ~20 days!\n• Australia: 4–6 weeks\n• USA: 4–12 weeks (interview required)\n\nFlygrad has a 99% visa success rate. We handle all documentation end-to-end!\n\n📅 Book a free visa consultation today.",
  "loan": "💳 Education loan options for study abroad:\n• SBI: Up to ₹1.5 Cr from 8.5% p.a.\n• HDFC Credila: Up to ₹1 Cr, no collateral options\n• Avanse: Fast approval, NBFC\n• Axis Bank / Bank of Baroda also available\n\nFlygrad helps you prepare all documents and get loan sanctioned BEFORE your visa appointment!\n\n📅 Book a free loan guidance session.",
  "pr": "🏡 Best PR pathways for Indian students:\n🥇 Canada: Express Entry in 2–3 years (fastest!)\n🥈 Germany: EU Blue Card → PR in 21 months\n🥉 Australia: Skills in Demand visa → PR in 3–5 yrs\n🏅 Ireland: 5 years residence\n🏅 UK: 5 years residence\n⚠️ USA: 10–20+ year backlog for Indians\n\nWant to settle abroad? Canada and Germany are your best bets!\n\n📅 Book a free PR strategy session with Flygrad."
};

function getFAQReply(text) {
  const t = text.toLowerCase();
  if (t.includes('germany') || t.includes('german')) return FAQ_ANSWERS.germany;
  if (t.includes('ireland') || t.includes('irish') || t.includes('ucd') || t.includes('trinity')) return FAQ_ANSWERS.ireland;
  if (t.includes('canada') || t.includes('pgwp') || t.includes('sds')) return FAQ_ANSWERS.canada;
  if (t.includes('uk') || t.includes('united kingdom') || t.includes('england') || t.includes('britain')) return FAQ_ANSWERS.uk;
  if (t.includes('australia') || t.includes('sydney') || t.includes('melbourne')) return FAQ_ANSWERS.australia;
  if (t.includes('usa') || t.includes('america') || t.includes('united states') || t.includes('us ')) return FAQ_ANSWERS.usa;
  if (t.includes('ielts') || t.includes('english test') || t.includes('band score')) return FAQ_ANSWERS.ielts;
  if (t.includes('cost') || t.includes('fee') || t.includes('expensive') || t.includes('cheap') || t.includes('budget')) return FAQ_ANSWERS.cost;
  if (t.includes('visa') || t.includes('permit') || t.includes('immigration')) return FAQ_ANSWERS.visa;
  if (t.includes('loan') || t.includes('finance') || t.includes('money') || t.includes('bank')) return FAQ_ANSWERS.loan;
  if (t.includes('pr ') || t.includes('permanent') || t.includes('residence') || t.includes('settle') || t.includes('citizenship')) return FAQ_ANSWERS.pr;
  return "Great question! 😊 I can help you with:\n\n🌍 **Best country** for MS, MBA or PhD\n📊 **Costs** — tuition + living expenses\n🛂 **Visa** process and timelines\n💳 **Education loans** — banks and rates\n🏡 **PR pathways** — which country is fastest\n\nJust type your question — or better yet, book a FREE 30-minute session with our expert counsellors who can give you personalised guidance!\n\n📅 Click below to book your free session.";
}

function toggleAgent() {
  agentOpen = !agentOpen;
  var win = document.getElementById('agentWindow');
  var bub = document.getElementById('agentBubble');
  var notif = document.querySelector('.agent-notif');
  if (win) win.classList.toggle('open', agentOpen);
  if (bub) bub.classList.toggle('open', agentOpen);
  if (notif) notif.style.display = 'none';
  if (agentOpen) {
    setTimeout(function() {
      var inp = document.getElementById('agentInput');
      if (inp) inp.focus();
    }, 300);
  }
}

function agentQuick(text) {
  var inp = document.getElementById('agentInput');
  if (inp) inp.value = text;
  var qb = document.getElementById('agentQuickBtns');
  if (qb) qb.style.display = 'none';
  agentSend();
}

function agentAddMsg(text, role) {
  var msgs = document.getElementById('agentMessages');
  if (!msgs) return;
  var isBot = (role === 'bot');
  var el = document.createElement('div');
  el.className = 'msg ' + role;
  var now = new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
  // Safe text rendering — replace newlines with <br>
  var safeText = text.split('\n').join('<br>');
  el.innerHTML =
    '<div class="msg-av">' + (isBot ? 'IT' : 'U') + '</div>' +
    '<div>' +
    '<div class="msg-bubble">' + safeText + '</div>' +
    '<div class="msg-time">' + now + '</div>' +
    '</div>';
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

function agentShowCTA() {
  var msgs = document.getElementById('agentMessages');
  if (!msgs) return;
  var cta = document.createElement('div');
  cta.style.cssText = 'background:linear-gradient(135deg,#FAF7F2,#FFF8EC);border:1.5px solid rgba(200,146,42,.25);border-radius:12px;padding:12px 14px;margin:4px 0;text-align:center';
  cta.innerHTML = '<div style="font-size:12.5px;color:#0B1F3A;font-weight:700;margin-bottom:8px;font-family:DM Sans,sans-serif">📅 Get personalised guidance — it\'s free!</div><button onclick="showPage(\'contact\');toggleAgent()" style="background:linear-gradient(135deg,#C8922A,#E8B45A);color:white;border:none;padding:8px 18px;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif">Book Free Counselling →</button>';
  msgs.appendChild(cta);
  msgs.scrollTop = msgs.scrollHeight;
}

async function agentSend() {
  var inputEl = document.getElementById('agentInput');
  if (!inputEl) return;
  var text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  var qb = document.getElementById('agentQuickBtns');
  if (qb) qb.style.display = 'none';

  agentAddMsg(text, 'user');
  agentHistory.push({role:'user', content:text});

  var typing = document.getElementById('agentTyping');
  if (typing) typing.classList.add('show');
  var msgs = document.getElementById('agentMessages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;

  // Always use server proxy — API key stays safe on the server
  try {
    var limited = agentHistory.slice(-10);
    var resp = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: limited })
    });
    var data = await resp.json();
    if (typing) typing.classList.remove('show');

    // If server says no key configured, use smart FAQ fallback
    if (data.faq) {
      var reply = data.faq;
      agentHistory.push({role:'assistant', content:reply});
      agentAddMsg(reply, 'bot');
    } else {
      var reply = (data.content && data.content[0] && data.content[0].text)
        ? data.content[0].text
        : getFAQReply(text);
      agentHistory.push({role:'assistant', content:reply});
      agentAddMsg(reply, 'bot');
    }
  } catch(err) {
    if (typing) typing.classList.remove('show');
    var fallback = getFAQReply(text);
    agentHistory.push({role:'assistant', content:fallback});
    agentAddMsg(fallback, 'bot');
  }

  if (false) {  // kept for structure
    // No API key — use instant smart FAQ answers
    setTimeout(function() {
      if (typing) typing.classList.remove('show');
      var reply = getFAQReply(text);
      agentHistory.push({role:'assistant', content:reply});
      agentAddMsg(reply, 'bot');
      if (agentHistory.filter(function(m){return m.role==='assistant';}).length >= 2) {
        setTimeout(agentShowCTA, 800);
      }
    }, 900);
    return;
  }

  if (agentHistory.filter(function(m){return m.role==='assistant';}).length >= 2) {
    setTimeout(agentShowCTA, 800);
  }
}

// Show notification dot after 8 seconds
setTimeout(function() {
  if (!agentOpen) {
    var n = document.querySelector('.agent-notif');
    if (n) n.style.display = 'flex';
  }
}, 8000);


var vfAnswers = {};
var vfCurrent = 1;

function vfSelect(step, answer) {
  vfAnswers[step] = answer;
  document.getElementById('vfp'+step).style.background = '#2563eb';
  document.getElementById('vf-step'+step).style.display = 'none';
  vfCurrent = step + 1;
  if (vfCurrent <= 4) {
    document.getElementById('vf-step'+vfCurrent).style.display = 'block';
  }
}

function vfResult() {
  document.getElementById('vf-step4').style.display = 'none';
  document.getElementById('vfp4').style.background = '#2563eb';
  var purpose = vfAnswers[1] || '';
  var country = vfAnswers[2] || '';
  var titles = {
    'Study Abroad': 'You need a Student Visa for ' + country,
    'Work & Career': 'You need a Work / Skilled Visa for ' + country,
    'Tourism / Visit': 'You need a Visitor / Tourist Visa for ' + country,
    'Business': 'You need a Business Visa for ' + country,
    'Family Reunion': 'You need a Family / Dependent Visa for ' + country,
    'Permanent Move': 'You may qualify for PR / Permanent Residency in ' + country,
  };
  document.getElementById('vf-result-title').textContent = titles[purpose] || 'We can help you!';
  document.getElementById('vf-result').style.display = 'block';
}

function vfReset() {
  vfAnswers = {}; vfCurrent = 1;
  for (var i=1;i<=4;i++) {
    var s = document.getElementById('vf-step'+i);
    var p = document.getElementById('vfp'+i);
    if (s) s.style.display = i===1 ? 'block':'none';
    if (p) p.style.background = '#e2e8f0';
  }
  document.getElementById('vf-result').style.display = 'none';
}


// Instant page show — hide loading flash
document.documentElement.style.visibility='visible';

// Preload next likely page on hover
document.addEventListener('mouseover',function(e){
  const a = e.target.closest('[onclick]');
  if(a){
    const fn = a.getAttribute('onclick');
    if(fn && fn.includes('showPage')){
      // prefetch hint — browser already has it since single file
    }
  }
},{passive:true});

// Performance: only render visible sections
if('IntersectionObserver' in window){
  const imgs = document.querySelectorAll('img[loading="lazy"]');
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        const img = e.target;
        if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src}
        obs.unobserve(img);
      }
    });
  },{rootMargin:'200px'});
  imgs.forEach(img=>obs.observe(img));
}


// ── Exit Intent Detection ──────────────────────
(function(){
  var shown = false;
  var dismissed = sessionStorage.getItem('exitDismissed');
  
  function showExitPopup(){
    if(shown || dismissed) return;
    shown = true;
    document.getElementById('exitPopup').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  
  window.closeExitPopup = function(){
    document.getElementById('exitPopup').classList.remove('show');
    document.body.style.overflow = '';
    sessionStorage.setItem('exitDismissed','1');
  };
  
  // Desktop: detect mouse leaving to top of page
  document.addEventListener('mouseleave', function(e){
    if(e.clientY < 10) showExitPopup();
  });
  
  // Mobile: show after 45 seconds of inactivity
  var mobileTimer;
  function resetTimer(){clearTimeout(mobileTimer); mobileTimer = setTimeout(showExitPopup, 45000);}
  ['touchstart','touchmove','scroll'].forEach(function(ev){
    document.addEventListener(ev, resetTimer, {passive:true});
  });
  resetTimer();
  
  // Close on overlay click
  document.getElementById('exitPopup').addEventListener('click', function(e){
    if(e.target === this) closeExitPopup();
  });

  // Track page changes for GA4
  var origShow = window.showPage;
  window.showPage = function(page){
    if(origShow) origShow(page);
    if(window.trackPage) window.trackPage(page);
  };
})();


// Back to top
window.addEventListener('scroll', function(){
  const btn = document.getElementById('backToTop');
  if(btn) btn.classList.toggle('visible', window.scrollY > 400);
}, {passive:true});

// Cookie consent
function acceptCookies(){
  localStorage.setItem('cookieConsent','accepted');
  document.getElementById('cookieBanner').classList.add('hidden');
  // Enable GA4 now that user consented
  if(window.gtag) gtag('consent','update',{'analytics_storage':'granted'});
}
function declineCookies(){
  localStorage.setItem('cookieConsent','declined');
  document.getElementById('cookieBanner').classList.add('hidden');
  if(window.gtag) gtag('consent','update',{'analytics_storage':'denied'});
}
// Check if already consented
(function(){
  const consent = localStorage.getItem('cookieConsent');
  if(consent) document.getElementById('cookieBanner').classList.add('hidden');
  // GA4 default denied until accepted
  if(window.gtag) gtag('consent','default',{'analytics_storage': consent==='accepted' ? 'granted' : 'denied'});
})();


// Multi-page navigation — replace SPA functions with href redirects
window.showPage = function(page) {
  const pageMap = {
    'home': '/', 'education': '/study-abroad', 'immigration': '/immigration',
    'financial': '/education-loan', 'it': '/travel-desk', 'contact': '/contact',
    'compare': '/compare-countries', 'privacy': '/privacy-policy', 'terms': '/terms',
    'guide-ireland': '/guide-ireland', 'guide-germany': '/guide-germany',
    'guide-canada': '/guide-canada', 'guide-uk': '/guide-uk',
    'guide-visa': '/guide-visa', 'guide-ielts': '/guide-ielts',
  };
  const url = pageMap[page] || '/' + page;
  window.location.href = url;
};

window.showCountry = function(country) {
  const map = {
    'ireland': '/study-in-ireland', 'uk': '/study-in-uk',
    'germany': '/study-in-germany', 'canada': '/study-in-canada',
    'australia': '/study-in-australia', 'usa': '/study-in-usa',
    'france': '/study-in-france', 'netherlands': '/study-in-ireland',
    'sweden': '/study-in-ireland',
  };
  window.location.href = map[country] || '/study-abroad';
};

// Mobile nav toggle
function toggleMobileNav() {
  document.querySelector('.mobile-nav')?.classList.toggle('open');
}

// Dropdown nav
document.addEventListener('DOMContentLoaded', function() {
  // Back to top
  window.addEventListener('scroll', function() {
    const btn = document.getElementById('backToTop');
    if(btn) btn.classList.toggle('visible', window.scrollY > 400);
  }, {passive:true});
});
