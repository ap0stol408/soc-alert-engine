/**
 * SSH client adapter used to execute commands on remote Nagios servers.
 * Used to retrieve the status.dat file.
 */

const { Client } = require('ssh2');
const fs = require('fs');

require('dotenv').config();


function executeRemoteCommand(host, command) {

  return new Promise((resolve, reject) => {

    const conn = new Client();

    conn.on('ready', () => {

      conn.exec(command, (err, stream) => {

        if (err) {
          conn.end();
          return reject(err);
        }

        let data = '';

        stream.on('data', (chunk) => {
          data += chunk.toString();
        });

        stream.on('close', () => {
          conn.end();
          resolve(data);
        });
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect({
      host: host,
      username: process.env.SSH_USER,
      privateKey: fs.readFileSync(`${process.env.HOME}/.ssh/id_ed25519_soc`)
    });
  });
}

module.exports = { executeRemoteCommand };