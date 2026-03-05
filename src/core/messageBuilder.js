/**
 * Message builder responsible for constructing alert
 * and recovery messages for external notification systems.
 */


/**
 * Formats a duration expressed in milliseconds.
 */
function formatDuration(ms) {

  const totalSeconds = Math.floor(ms / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let parts = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}


/**
 * Calculate the service duration using Nagios timestamps.
 * Duration = last_check - last_state_change
 */
function calculateDuration(service) {

  const start = parseInt(service.last_state_change)
  const end = parseInt(service.last_check)

  const diff = end - start

  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60

  return `${days}d ${hours}h ${minutes}m ${seconds}s`
}


/**
 * Build an alert message for WARNING or CRITICAL events.
 */
function buildAlertMessage(service, stateData, type = 'message') {

  const severity =
    service.current_state === '2' ? 'CRITICAL' : 'WARNING';

  const duration = calculateDuration(service)

  const emoji = type === 'call' ? '📞' : '📩';

  const actionText =
    type === 'call'
      ? 'CALL ALERT'
      : 'WHATSAPP ALERT';

  return `
${emoji} ${actionText} [${severity}] [${service.source.toUpperCase()}]

Host: ${service.host_name}
Service: ${service.service_description}
Duration: ${duration}
Ack: ${stateData.acknowledged ? 'YES' : 'NO'}

`.trim() + '\n';
}


/**
 * Build a recovery message when a service returns to OK.
 */
function buildRecoveryMessage(service, stateData) {

 const duration = formatDuration(
  (parseInt(service.last_check) * 1000) - stateData.firstSeen
);

  return `
📩 WHATSAPP ALERT [RECOVERY] [${service.source.toUpperCase()}]

Host: ${service.host_name}
Service: ${service.service_description}
Total Duration: ${duration}

`.trim() + '\n';
}

module.exports = {
  buildAlertMessage,
  buildRecoveryMessage
};