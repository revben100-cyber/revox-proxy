const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_API_KEY = "re_i8dEa1Ef_JwznDnBHJmwnCdosuBtgXSzJ";
const REPORT_EMAIL = "revben100@gmail.com";
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:3001/auth/callback";

console.log("API Key loaded:", ANTHROPIC_API_KEY ? "YES - length: " + ANTHROPIC_API_KEY.length : "NO - MISSING");

const oauth2Client = new google.auth.OAuth2(
  "372678198010-ioqgq8mglfkk9vkbog57itgb6a750u9i.apps.googleusercontent.com",
  "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",
  REDIRECT_URI
);

let calendarTokens = null;

// Google Auth
app.get("/auth/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  calendarTokens = tokens;
  oauth2Client.setCredentials(tokens);
  res.send(`
    <html><body style="background:#0B0F1A;color:#34D399;font-family:sans-serif;text-align:center;padding:60px">
      <h1>✅ Google Calendar Connected!</h1>
      <p>You can close this tab and go back to REVOX.</p>
    </body></html>
  `);
});

// Calendar today
app.get("/calendar/today", async (req, res) => {
  if (!calendarTokens) return res.json({ connected: false, events: [] });
  try {
    oauth2Client.setCredentials(calendarTokens);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59);
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });
    const events = response.data.items.map((e) => ({
      title: e.summary,
      time: e.start.dateTime || e.start.date,
      location: e.location || "",
    }));
    res.json({ connected: true, events });
  } catch (err) {
    res.json({ connected: false, events: [], error: err.message });
  }
});

// Claude API
app.post("/api/chat", async (req, res) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    console.log("API Response:", JSON.stringify(data).slice(0, 200));
    res.json(data);
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generate weekly report with Claude
async function generateWeeklyReport() {
  const prompt = `You are REVOX, AI Chief of Staff for Rev, a Biomedical Equipment Sales Rep in Tanzania.

Generate a professional weekly pipeline report for the week. Format it as clean HTML email content.

Include:
1. 📊 PIPELINE SUMMARY — Total value TZS 162M across 3 deals
2. 🎯 DEAL STATUS UPDATE:
   - Amana Regional Referral Hospital — Ultrasound + Monitors — TZS 45M — PROSPECTING — Send quotation this week
   - KCMC — Surgical Table + Anesthesia Machine — TZS 95M — NEGOTIATION — Discount discussion ongoing
   - Dr. Amara Polyclinic — Lab Analyzer + Reagents — TZS 22M — CLOSING — Waiting LPO signature
3. 🔔 TOP 3 PRIORITIES FOR THIS WEEK
4. 💡 POWER MOVE OF THE WEEK
5. 📈 REVENUE FORECAST — Weighted: TZS 88.3M

Keep it sharp, executive, and actionable. Use emojis for sections. Plain text format, no HTML tags.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  return data?.content?.[0]?.text || "Weekly report generation failed.";
}

// Send weekly email via Resend
async function sendWeeklyEmail() {
  console.log("Generating weekly report...");
  const reportContent = await generateWeeklyReport();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-TZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Inter', Arial, sans-serif; background: #0B0F1A; color: #E2E8F0; max-width: 600px; margin: 0 auto; padding: 0;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #00C2A8, #4F8EF7); padding: 32px 24px; text-align: center;">
    <div style="font-size: 32px; margin-bottom: 8px;">⚡</div>
    <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">REVOX Weekly Report</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">${dateStr}</p>
  </div>

  <!-- Pipeline Snapshot -->
  <div style="background: #141C2E; padding: 24px; border-bottom: 1px solid #1E2A3A;">
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; text-align: center;">
      <div style="background: #0B0F1A; border-radius: 10px; padding: 16px; border: 1px solid #00C2A830;">
        <div style="font-size: 20px; font-weight: 800; color: #00C2A8;">TZS 162M</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Total Pipeline</div>
      </div>
      <div style="background: #0B0F1A; border-radius: 10px; padding: 16px; border: 1px solid #4F8EF730;">
        <div style="font-size: 20px; font-weight: 800; color: #4F8EF7;">TZS 88.3M</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Weighted Forecast</div>
      </div>
      <div style="background: #0B0F1A; border-radius: 10px; padding: 16px; border: 1px solid #34D39930;">
        <div style="font-size: 20px; font-weight: 800; color: #34D399;">3</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Active Deals</div>
      </div>
    </div>
  </div>

  <!-- Deal Cards -->
  <div style="background: #0F1422; padding: 24px; border-bottom: 1px solid #1E2A3A;">
    <h2 style="color: #F1F5F9; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px;">Active Deals</h2>
    
    <div style="background: #141C2E; border-radius: 10px; padding: 16px; border-left: 4px solid #F59E0B; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-weight: 700; color: #F1F5F9; font-size: 14px;">Amana Regional Referral Hospital</div>
          <div style="color: #64748B; font-size: 12px; margin-top: 3px;">Portable Ultrasound + 2x Patient Monitors</div>
        </div>
        <span style="background: #F59E0B20; color: #F59E0B; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px;">PROSPECTING</span>
      </div>
      <div style="margin-top: 10px; display: flex; justify-content: space-between;">
        <span style="color: #94A3B8; font-size: 13px; font-weight: 600;">TZS 45,000,000</span>
        <span style="color: #64748B; font-size: 11px;">30% close probability</span>
      </div>
      <div style="margin-top: 8px; color: #475569; font-size: 12px; border-top: 1px solid #1E2A3A; padding-top: 8px;">→ Send formal quotation and spec sheet this week</div>
    </div>

    <div style="background: #141C2E; border-radius: 10px; padding: 16px; border-left: 4px solid #4F8EF7; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-weight: 700; color: #F1F5F9; font-size: 14px;">Kilimanjaro Christian Medical Centre</div>
          <div style="color: #64748B; font-size: 12px; margin-top: 3px;">Surgical Table + Anesthesia Machine (bundle)</div>
        </div>
        <span style="background: #4F8EF720; color: #4F8EF7; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px;">NEGOTIATION</span>
      </div>
      <div style="margin-top: 10px; display: flex; justify-content: space-between;">
        <span style="color: #94A3B8; font-size: 13px; font-weight: 600;">TZS 95,000,000</span>
        <span style="color: #64748B; font-size: 11px;">65% close probability</span>
      </div>
      <div style="margin-top: 8px; color: #475569; font-size: 12px; border-top: 1px solid #1E2A3A; padding-top: 8px;">→ Counter discount offer after supplier margin approval</div>
    </div>

    <div style="background: #141C2E; border-radius: 10px; padding: 16px; border-left: 4px solid #34D399;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-weight: 700; color: #F1F5F9; font-size: 14px;">Dr. Amara Polyclinic (Mabibo)</div>
          <div style="color: #64748B; font-size: 12px; margin-top: 3px;">Laboratory Analyzer + Reagent Supply Contract</div>
        </div>
        <span style="background: #34D39920; color: #34D399; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px;">CLOSING</span>
      </div>
      <div style="margin-top: 10px; display: flex; justify-content: space-between;">
        <span style="color: #94A3B8; font-size: 13px; font-weight: 600;">TZS 22,000,000</span>
        <span style="color: #64748B; font-size: 11px;">90% close probability</span>
      </div>
      <div style="margin-top: 8px; color: #475569; font-size: 12px; border-top: 1px solid #1E2A3A; padding-top: 8px;">→ Collect signed LPO and confirm installation date</div>
    </div>
  </div>

  <!-- AI Report Content -->
  <div style="background: #141C2E; padding: 24px; border-bottom: 1px solid #1E2A3A;">
    <h2 style="color: #F1F5F9; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px;">⚡ REVOX Intelligence Report</h2>
    <div style="color: #CBD5E1; font-size: 13px; line-height: 1.8; white-space: pre-wrap;">${reportContent}</div>
  </div>

  <!-- Footer -->
  <div style="background: #0B0F1A; padding: 20px 24px; text-align: center; border-top: 1px solid #1E2A3A;">
    <p style="color: #475569; font-size: 11px; margin: 0;">REVOX · Powered by Claude · Biomedical Sales Intelligence · Tanzania</p>
    <p style="color: #334155; font-size: 10px; margin: 6px 0 0;">This report was automatically generated for Rev — Biomedical Sales Rep</p>
  </div>

</body>
</html>`;

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "REVOX Agent <onboarding@resend.dev>",
      to: [REPORT_EMAIL],
      subject: `⚡ REVOX Weekly Report — ${dateStr}`,
      html: htmlContent,
    }),
  });

  const emailData = await emailResponse.json();
  console.log("Email sent:", JSON.stringify(emailData));
  return emailData;
}

// Manual trigger endpoint
app.get("/send-weekly-report", async (req, res) => {
  try {
    const result = await sendWeeklyEmail();
    res.json({ success: true, message: "Weekly report sent!", data: result });
  } catch (err) {
    console.error("Email error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto-schedule: every Sunday at 7PM EAT (UTC+3 = 16:00 UTC)
function scheduleWeeklyReport() {
  const checkSchedule = () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay(); // 0=Sunday

    if (dayOfWeek === 0 && utcHour === 16 && utcMinutes === 0) {
      console.log("Sending scheduled weekly report...");
      sendWeeklyEmail().catch(console.error);
    }
  };

  setInterval(checkSchedule, 60000); // Check every minute
  console.log("Weekly report scheduler active — runs every Sunday at 7PM EAT");
}

scheduleWeeklyReport();

app.listen(3001, () => console.log("REVOX Proxy running on port 3001"));