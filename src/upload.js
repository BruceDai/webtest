'use strict';

const {spawnSync} = require('child_process');
const util = require('./util.js');

const upload = () => {
  const server = util.settings.resultServer;
  const remoteDir = `${server.saveDir}/${util.platform.toUpperCase()}`;
  const mkdirResult = spawnSync(
      'ssh', [`${server.user}@${server.ip}`, 'mkdir', '-p', remoteDir]);
  const targetDir = `${server.user}@${server.ip}:${remoteDir}`;
  if (mkdirResult.status === 0) {
    const scpResult = spawnSync('scp', ['-r', util.timestampDir, targetDir]);
    if (scpResult.status !== 0) {
      util.log(`Failed to upload ${util.timestampDir} on ${targetDir}`);
    } else {
      util.log(`Successfully uploaded ${util.timestampDir} on ${targetDir}`);
    }
  } else {
    util.log(`Failed to create remote directory: ${targetDir}`);
  }
};

module.exports = upload;
