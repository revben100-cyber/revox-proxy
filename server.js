const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

console.log("KEY CHECK:", ANTHROPIC_API_KEY ? "FOUND length=" + ANTHROPIC_API_KEY.length : "MISSING");
console.log("API Key loaded:", process.env.ANTHROPIC_API_KEY ? "YES - length: " + process.env.ANTHROPIC_API_KEY.length : "NO - MISSING");
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = "process.env.ANTHROPIC_API_KEY;";

const oauth2Client = new google.auth.OAuth2(
  "372678198010-ioqgq8mglfkk9vkbog57itgb6a750u9i.apps.googleusercontent.com",
  "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",
  "http://localhost:3001/auth/callback"
);

let calendarTokens = null;

// Step 1: Start Google Auth
app.get("/auth/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  res.redirect(url);
});

// Step 2: Handle callback
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

// Step 3: Get today's calendar events
app.get("/calendar/today", async (req, res) => {
  if (!calendarTokens) {
    return res.json({ connected: false, events: [] });
  }
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
      description: e.description || "",
    }));

    res.json({ connected: true, events });
  } catch (err) {
    res.json({ connected: false, events: [], error: err.message });
  }
});

// Claude API proxy
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

app.listen(3001, () => console.log("REVOX Proxy running on port 3001"));