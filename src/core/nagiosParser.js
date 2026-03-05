/**
 * Parses the Nagios status.dat file and extracts service status blocks.
 */

function parseServices(statusData) {

  const services = [];
  const lines = statusData.split('\n');

  let inServiceBlock = false;
  let currentService = {};

  for (let line of lines) {

    const trimmed = line.trim();

    /**
     * Start of a service block
     */
    if (trimmed === 'servicestatus {') {
      inServiceBlock = true;
      currentService = {};
      continue;
    }

    /**
     * End of a service block
     */
    if (inServiceBlock && trimmed === '}') {
      services.push(currentService);
      inServiceBlock = false;
      currentService = {};
      continue;
    }

    /**
     * Parse key=value lines inside the service block
     */
    if (inServiceBlock && trimmed.includes('=')) {

      const index = trimmed.indexOf('=');

      const key = trimmed.substring(0, index).trim();
      const value = trimmed.substring(index + 1).trim();

      currentService[key] = value;
    }
  }

  return services;
}

module.exports = { parseServices };