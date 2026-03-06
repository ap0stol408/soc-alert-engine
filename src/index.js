/**
 * Main entry point for the SOC Alert Engine.
 */

require('dotenv').config();
const cron = require('node-cron');

const { fetchNagiosStatus } = require('./pollers/nagiosPoller');
const { parseServices } = require('./core/nagiosParser');

const {
  evaluateService,
  updateMessageTimestamp,
  updateCallTimestamp
} = require('./core/stateManager');

const {
  buildAlertMessage,
  buildRecoveryMessage
} = require('./core/messageBuilder');

const { pollEmailAlerts } = require('./pollers/emailPoller');

/**
 * Twilio adapter
 */
const { sendWhatsApp } = require('./adapters/twilioClient');


let firstRun = true;


/**
 * Process email alerts detected by the email poller.
 */
async function processEmailAlert(event) {

  console.log("EMAIL ALERT EVENT:", event);

  const message = `
📩 WHATSAPP ALERT [EMAIL]

Source: EMAIL
Subject: ${event.subject}
Type: ${event.type}
`.trim() + '\n';

  await sendWhatsApp(message);

}


/**
 * Main polling routine executed periodically.
 */
async function poll() {

  try {

    console.log('Polling Nagios...');

    const saturnoData = await fetchNagiosStatus(
      process.env.SATURNO,
      process.env.NAGIOS_SATURNO_PATH
    );

    const venusData = await fetchNagiosStatus(
      process.env.VENUS,
      process.env.NAGIOS_VENUS_PATH
    );

    const saturnoServices = parseServices(saturnoData).map(s => ({
      ...s,
      source: 'saturno'
    }));

    const venusServices = parseServices(venusData).map(s => ({
      ...s,
      source: 'venus'
    }));

    const services = [...saturnoServices, ...venusServices];

    const hardServices = services.filter(
      service => service.state_type === '1'
    );


    if (firstRun) {

      console.log('Initial snapshot taken. Building baseline...');

      hardServices.forEach(s => evaluateService(s));

      firstRun = false;

    } else {

      for (const service of hardServices) {

        const result = evaluateService(service);

        if (!result) continue;

        const now = Date.now();

        /**
         * CRITICAL
         */
        if (result.state === '2' && !result.acknowledged) {

          if (now - result.lastMessage > 10 * 60 * 1000) {

            const message = buildAlertMessage(service, result, 'message');

            await sendWhatsApp(message);

            updateMessageTimestamp(result.key);

          }

          if (now - result.lastCall > 10 * 60 * 1000) {

            const callMessage = buildAlertMessage(service, result, 'call');

            await sendWhatsApp(callMessage);

            updateCallTimestamp(result.key);

          }

        }

        /**
         * WARNING
         */
        if (result.state === '1' && !result.acknowledged) {

          if (now - result.lastMessage > 30 * 60 * 1000) {

            const message = buildAlertMessage(service, result, 'message');

            await sendWhatsApp(message);

            updateMessageTimestamp(result.key);

          }

        }

        /**
         * RECOVERY
         */
        if (result.state === '0' && result.recovered) {

          const recoveryMessage = buildRecoveryMessage(service, result);

          await sendWhatsApp(recoveryMessage);

          updateMessageTimestamp(result.key);

        }

      }

    }

    /**
     * Email alerts
     */
    console.log("Polling Email alerts...");

    await pollEmailAlerts(processEmailAlert);

  } catch (error) {

    console.error('Error:', error.message);

  }

}


cron.schedule('*/1 * * * *', poll);

console.log('SOC Alert Engine started...');