/**
 * Email Subject Parser
 *
 * This module inspects the subject of incoming emails
 * and determines whether the message corresponds to a
 * known alert rule.
 *
 * If the subject matches a configured rule, the parser
 * returns an alert object containing the alert type.
 *
 * If no rule matches, null is returned.
 */


/**
 * List of email subject patterns that trigger alerts.
 * Each rule contains:
 *
 * - match: text expected in the subject line
 * - alert_type: internal identifier used by the alert engine
 */
const alertRules = [

  {
    match: "Splunk Alert: Equipo CISCO sin logs en Splunk",
    alert_type: "splunk_cisco_no_logs"
  },

  {
    match: "Splunk Alert: A10_HTTP_Wrong_Status_Code",
    alert_type: "splunk_a10_http_wrong_status"
  },

  {
    match: "Splunk Alert: SLB Server HTTP Timeout",
    alert_type: "splunk_slb_http_timeout"
  },

  {
    match: "Splunk Alert: A10 GSLB Alert",
    alert_type: "splunk_a10_gslb_alert"
  },

  {
    match: "Splunk Alert: Anomalia en Eventos fuera de la media en MMXMTZRPFW01 - Horario laboral L-V",
    alert_type: "splunk_firewall_anomaly_events"
  },
  {
    match: "is DOWN",
    alert_type: "nagios_host_down"
  },
  {
    match: "is CRITICAL",
    alert_type: "nagios_service_critical"
  }

];


/**
 * Detect whether an email subject matches any alert rule.
 *
 * @param {string} subject - Email subject line
 * @returns {object|null} Alert information or null if no match
 */
function detectEmailAlert(subject) {

  if (!subject) return null;

  for (const rule of alertRules) {

    /**
     * Use substring matching to allow flexibility
     * if additional text is appended to the subject.
     */
    if (subject.includes(rule.match)) {

      return {
        alert_type: rule.alert_type
      };

    }

  }

  return null;

}

module.exports = detectEmailAlert;