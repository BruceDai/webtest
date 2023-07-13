'use strict';

const {exec, execSync} = require('child_process');
const si = require('systeminformation');
const util = require('./util.js');

const getConfig = async () => {
  // CPU
  const cpuData = await si.cpu();
  let cpuName = cpuData.brand;
  const cpuManufacturer = cpuData.manufacturer;
  if (cpuManufacturer.includes('Intel')) {
    cpuName = cpuName.split(' ').pop();
  } else if (cpuManufacturer.includes('AMD')) {
    // Trim the brand name, e.g. Ryzen 7 4700U with Radeon Graphics -> Ryzen 7
    // 4700U
    cpuName = cpuName.split(' ').slice(0, 3).join(' ');
  }
  util['cpuName'] = cpuName;
  util['pthreadPoolSize'] = Math.min(4, Number(cpuData.physicalCores));

  // GPU
  if (util['platform'] === 'win32') {
    const info =
        execSync(
            'wmic path win32_VideoController get Name,DriverVersion,Status,' +
            'PNPDeviceID /value')
            .toString()
            .split('\n');
    for (let i = 1; i < info.length; i++) {
      let match;
      match = info[i].match('DriverVersion=(.*)');
      if (match) {
        util['gpuDriverVersion'] = match[1];
      }
      match = info[i].match('Name=(.*)');
      if (match) {
        util['gpuName'] = match[1];
      }
      match = info[i].match('PNPDeviceID=.*DEV_(.{4})');
      if (match) {
        util['gpuDeviceId'] = match[1].toUpperCase();
      }
      match = info[i].match('Status=(.*)');
      if (match) {
        if (util['gpuName'].match('Microsoft')) {
          continue;
        }
        if (match[1] == 'OK') {
          break;
        }
      }
    }
  } else {
    const gpuData = await si.graphics();
    for (let i = 0; i < gpuData.controllers.length; i++) {
      if (gpuData.controllers[i].vendor == 'Microsoft') {
        continue;
      }
      util['gpuName'] = gpuData.controllers[i].model;
    }

    if (util['platform'] === 'linux') {
      util['gpuDriverVersion'] =
          execSync('glxinfo |grep "OpenGL version"').toString().trim()
              .split('Mesa').pop();
    }
  }

  // OS version
  if (util['platform'] === 'win32') {
    util['osVersion'] = await new Promise((resolve, reject) => {
      exec('ver', (error, stdout, stderr) => {
        resolve(stdout);
      });
    });
  } else if (util['platform'] === 'linux') {
    const osInfo = await si.osInfo();
    util['osVersion'] = osInfo.release;
  }

  if (util['platform'] === 'win32') {
    const chromeInfo = execSync(
        `reg query "HKEY_CURRENT_USER\\Software\\Google\\` +
        `Chrome SxS\\BLBeacon" /v version`)
        .toString();
    const chromeMatch = chromeInfo.match('REG_SZ (.*)');
    util['chromeVersion'] = chromeMatch[1];
    const edgeInfo = execSync(
        `reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\` +
        `Edge SxS\\BLBeacon" /v version`)
        .toString();
    const edgeMatch = edgeInfo.match('REG_SZ (.*)');
    util['edgeVersion'] = edgeMatch[1];
  } else if (util['platform'] === 'linux') {
    util['chromeVersion'] =
        execSync('/usr/bin/google-chrome-unstable --version').toString().trim();
    util['edgeVersion'] =
        execSync('/usr/bin/microsoft-edge-dev --version').toString().trim();
  }
};

module.exports = getConfig;
