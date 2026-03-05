/*
Email Poller

This module connects to the IMAP server and periodically checks
for new emails in the INBOX.

It uses IMAP UID tracking to ensure emails are not processed twice.
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

    /*
    Prevent invalid message range
    */
    if (startUID > endUID) {

      await client.logout();
      return;

    }

    console.log(`Checking emails UID ${startUID} -> ${endUID}`);

    /*
    Fetch new emails
    */
    try {

      for await (let message of client.fetch(
        { uid: `${startUID}:*` },
        { envelope: true }
      )) {

        const subject = message.envelope.subject || "";

        const alert = detectEmailAlert(subject);

        if (alert) {

          console.log("Email alert detected:", subject);

          const event = {

            source: "email",
            subject: subject,
            type: alert.alert_type,
            uid: message.uid

          };

          await processAlert(event);

        }

        state.lastUID = message.uid;

      }

    } catch (err) {

      console.error("IMAP fetch error:", err.message);

    }

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