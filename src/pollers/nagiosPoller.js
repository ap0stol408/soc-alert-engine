/**
 * Poller responsible for retrieving the Nagios status.dat file
 * from a remote monitoring node via SSH.
 */

const { executeRemoteCommand } = require('../adapters/sshClient');

require('dotenv').config();


async function fetchNagiosStatus(host, path) {

  const command = `cat ${path}`;

  const data = await executeRemoteCommand(host, command);

  return data;
}

module.exports = { fetchNagiosStatus };