/*
Email Poller

This module connects to the IMAP server and periodically checks
for new emails in the INBOX.

On startup it generates a summary of backlog alerts instead of
sending one message per email.
*/

const fs = require("fs");
const path = require("path");
const { ImapFlow } = require("imapflow");

const detectEmailAlert = require("../parsers/emailSubjectParser");

const STATE_FILE = path.join(__dirname, "../../data/email_state.json");

/*
Load the last processed UID from disk.
*/
function loadState() {

  try {

    if (!fs.existsSync(STATE_FILE)) {
      return { lastUID: null };
    }

    const raw = fs.readFileSync(STATE_FILE, "utf8");

    if (!raw.trim()) {
      return { lastUID: null };
    }

    return JSON.parse(raw);

  } catch (err) {

    console.error("Email state corrupted. Resetting...");
    return { lastUID: null };

  }

}

/*
Persist the last processed UID
*/
function saveState(state) {

  try {

    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(state, null, 2)
    );

  } catch (err) {

    console.error("Error saving email state:", err.message);

  }

}

async function pollEmailAlerts(processAlert) {

  const state = loadState();

  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT),
    secure: process.env.IMAP_SECURE === "true",

    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS
    },

    logger: false
  });

  try {

    await client.connect();

    const mailbox = await client.mailboxOpen("INBOX");

    const uidNext = mailbox.uidNext;

    /*
    First run baseline
    */
    if (state.lastUID === null) {

      state.lastUID = uidNext - 1;
      saveState(state);

      console.log("Email baseline created. Starting from UID:", state.lastUID);

      await client.logout();
      return;

    }

    /*
    If no new emails exist
    */
    if (uidNext - 1 <= state.lastUID) {

      await client.logout();
      return;

    }

    const startUID = state.lastUID + 1;
    const endUID = uidNext - 1;

    console.log(`Checking emails UID ${startUID} -> ${endUID}`);

    let summary = [];
    let lastProcessedUID = state.lastUID;

    /*
    Fetch new emails
    */
    for await (let message of client.fetch(
      { uid: `${startUID}:*` },
      { envelope: true, internalDate: true }
    )) {

      const subject = message.envelope.subject || "";
      const date = message.internalDate;

      const alert = detectEmailAlert(subject);

      if (alert) {

        summary.push({
          date,
          subject
        });

      }

      lastProcessedUID = message.uid;

    }

    /*
    If backlog exists → send summary instead of individual alerts
    */
    if (summary.length > 0) {

      console.log(`Backlog detected (${summary.length} alerts). Sending summary.`);

      const totalAlerts = summary.length;

      /*
      Take last 20 alerts
      */
      let recentAlerts = summary.slice(-20);

      function buildMessage(alertList) {

        const lines = alertList.map(a => {

          const formattedDate =
            a.date.toLocaleString('sv-SE', {
            timeZone: 'America/Mexico_City',
            hour12: false
          }).substring(0,16);

          return `${formattedDate} - ${a.subject}`;

        });

        return `
📊 SOC ALERT SUMMARY

Showing last ${alertList.length} alerts (${totalAlerts} total)

${lines.join("\n")}
`.trim() + "\n";

      }

      let message = buildMessage(recentAlerts);

      /*
      Twilio limit protection (1600 chars)
      */
      if (message.length > 1600) {

        console.log("Summary too long, reducing to last 10 alerts.");

        recentAlerts = summary.slice(-10);

        message = buildMessage(recentAlerts);

      }

      await processAlert({
        source: "email_summary",
        subject: message,
        type: "summary"
      });

    }

    /*
    Update state
    */
    state.lastUID = lastProcessedUID;

    saveState(state);

    await client.logout();

  } catch (err) {

    console.error("Email polling error:", err.message);

    try {
      await client.logout();
    } catch {}

  }

}

module.exports = { pollEmailAlerts };