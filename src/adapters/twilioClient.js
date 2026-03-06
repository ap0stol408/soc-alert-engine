/**
 * Twilio client adapter
 * Responsible for sending WhatsApp alerts using Twilio API
 */

const twilio = require('twilio');

require('dotenv').config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);


/**
 * Send WhatsApp alert message
 */
async function sendWhatsApp(message) {

  try {

    const response = await client.messages.create({

      from: "whatsapp:+14155238886",
      to: "whatsapp:+5215542660668",
      body: message

    });

    console.log(`WhatsApp sent: ${response.sid}`);

  } catch (err) {

    console.error("Twilio send error:", err.message);

  }

}

module.exports = { sendWhatsApp };