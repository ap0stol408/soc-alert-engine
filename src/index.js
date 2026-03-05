/**
 * Main entry point for the SOC Alert Engine.
 *
 * Responsibilities:
 * - Poll Nagios status.dat from multiple monitoring nodes
 * - Parse service states
 * - Detect state transitions using the state manager
 * - Generate alert or recovery messages
 * - Apply notification rate limits
 * - Poll email inbox for alert subjects
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

/**
 * Email alert poller
 */
const { pollEmailAlerts } = require('./pollers/emailPoller');


/**
 * Indicates if the engine is performing the initial baseline.
 * During the first run, existing alerts are registered but not notified.
 */
let firstRun = true;


/**
 * Process email alerts detected by the email poller.
 * Each email alert is treated as a single event.
 */
async function processEmailAlert(event) {

  console.log("EMAIL ALERT EVENT:", event);

  const message = `
📩 WHATSAPP ALERT [EMAIL]

Source: EMAIL
Subject: ${event.subject}
Type: ${event.type}
`.trim() + '\n';

  const callMessage = `
📞 CALL ALERT [EMAIL]

Source: EMAIL
Subject: ${event.subject}
Type: ${event.type}
`.trim() + '\n';

  console.log(message);
  console.log(callMessage);

  /**
   * Later this will be replaced with:
   * sendWhatsApp(message)
   * makeCall(callMessage)
   */
}


/**
 * Main polling routine executed periodically.
 * Retrieves Nagios status, processes service states,
 * and checks for email-based alerts.
 */
async function poll() {

  try {

    console.log('Polling Nagios...');

    /**
     * Retrieve status.dat from the Saturno monitoring node
     */
    const saturnoData = await fetchNagiosStatus(
      process.env.SATURNO,
      process.env.NAGIOS_SATURNO_PATH
    );

    /**
     * Retrieve status.dat from the Venus monitoring node
     */
    const venusData = await fetchNagiosStatus(
      process.env.VENUS,
      process.env.NAGIOS_VENUS_PATH
    );

    /**
     * Parse services and tag their source node
     */
    const saturnoServices = parseServices(saturnoData).map(s => ({
      ...s,
      source: 'saturno'
    }));

    const venusServices = parseServices(venusData).map(s => ({
      ...s,
      source: 'venus'
    }));


    /**
     * Combine services from both monitoring nodes
     */
    const services = [...saturnoServices, ...venusServices];


    /**
     * Only HARD states are considered for alerting.
     * SOFT states are ignored to avoid noise.
     */
    const hardServices = services.filter(
      service => service.state_type === '1'
    );


    /**
     * Initial baseline.
     * Existing problems are registered but alerts are not sent.
     */
    if (firstRun) {

      console.log('Initial snapshot taken. Building baseline...');

      hardServices.forEach(s => evaluateService(s));

      firstRun = false;

    } else {

      /**
       * Evaluate each service state and trigger alerts if necessary.
       */
      hardServices.forEach(service => {

        const result = evaluateService(service);

        if (!result) return;

        const now = Date.now();

        /**
         * CRITICAL state handling.
         * Triggers both message and call notifications.
         */
        if (result.state === '2' && !result.acknowledged) {

          if (now - result.lastMessage > 10 * 60 * 1000) {

            const message = buildAlertMessage(service, result, 'message');

            console.log(message);

            updateMessageTimestamp(result.key);

          }

          if (now - result.lastCall > 10 * 60 * 1000) {

            const callMessage = buildAlertMessage(service, result, 'call');

            console.log(callMessage);

            updateCallTimestamp(result.key);

          }

        }


        /**
         * WARNING state handling.
         * Only message alerts are sent.
         */
        if (result.state === '1' && !result.acknowledged) {

          if (now - result.lastMessage > 30 * 60 * 1000) {

            const message = buildAlertMessage(service, result, 'message');

            console.log(message);

            updateMessageTimestamp(result.key);

          }

        }


        /**
         * Recovery detection.
         * Sent when a service returns to OK state.
         */
        if (result.state === '0' && result.recovered) {

          const recoveryMessage = buildRecoveryMessage(service, result);

          console.log(recoveryMessage);

          updateMessageTimestamp(result.key);

        }

      });

    }


    /**
     * Poll email inbox for new alerts.
     * Each detected email alert is processed as an event.
     */
    console.log("Polling Email alerts...");

    await pollEmailAlerts(processEmailAlert);


  } catch (error) {

    console.error('Error:', error.message);

  }

}


/**
 * Poll the system every minute.
 * This includes:
 * - Nagios alerts
 * - Email alerts
 */
cron.schedule('*/1 * * * *', poll);

console.log('SOC Alert Engine started...');