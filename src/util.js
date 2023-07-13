'use strict';
const {spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// let settings;
let logFile;

const platform = os.platform();

const browserPath = {
  'win32': {
    // Chrome Canary
    'chrome':
        `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`,
    // Edge Canary
    'edge':
        `${process.env.LOCALAPPDATA}/Microsoft/Edge SxS/Application/msedge.exe`,
  },
  'linux': {
    // Chrome Dev
    'chrome': '/usr/bin/google-chrome-unstable',
    // Edge Dev
    'edge': '/usr/bin/microsoft-edge-dev',
  },
};

const userDataDir = {
  'win32': {
    // Chrome Canary
    'chrome': `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data`,
    // Edge Canary
    'edge': `${process.env.LOCALAPPDATA}/Microsoft/Edge SxS/User Data`,
  },
  'linux': {
    // Chrome Dev
    'chrome':
        `/home/${os.userInfo().username}/.config/google-chrome-unstable`,
    // Edge Dev
    'edge': `/home/${os.userInfo().username}/.config/microsoft-edge-dev`,
  },
};

const outDir = path.join(path.resolve(__dirname), '../out', platform);

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }
};

ensureDir(outDir);

const capitalize = (s) => {
  return s[0].toUpperCase() + s.slice(1);
};

const uncapitalize = (s) => {
  return s[0].toLowerCase() + s.slice(1);
};

const ensureNoDir = (dir) => {
  fs.rmSync(dir, {recursive: true, force: true});
};

const ensureNoFile = (file) => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
};

const parseJsonFile = (fileName) => {
  const jsonFile =
      path.join(path.resolve(__dirname), fileName);
  const jsonContent = JSON.parse(fs.readFileSync(jsonFile, 'utf8')
      .replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
          (m, g) => g ? '' : m));
  return jsonContent;
};

const log = (info) => {
  console.log(info);
  fs.appendFileSync(logFile, String(info) + '\n');
};

const setLogFile = (fileName) => {
  logFile = fileName;
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const killBrowser = (browser) => {
  if (platform === 'linux') {
    const browserName = browser.includes('chrome') ? 'chrome' : 'edge';
    spawnSync('pkill', ['-f', browserName]);
  } else if (platform === 'win32') {
    const imageName = browser.includes('chrome') ? 'chrome.exe' : 'msedge.exe';
    spawnSync('cmd', ['/c', `taskkill /F /IM ${imageName} /T`]);
  }
};

module.exports = {
  'browserPath': browserPath,
  'hostname': os.hostname(),
  'platform': platform,
  'outDir': outDir,
  'userDataDir': userDataDir,
  'capitalize': capitalize,
  'ensureDir': ensureDir,
  'ensureNoDir': ensureNoDir,
  'ensureNoFile': ensureNoFile,
  'killBrowser': killBrowser,
  'parseJsonFile': parseJsonFile,
  'log': log,
  'setLogFile': setLogFile,
  'sleep': sleep,
  'uncapitalize': uncapitalize,
};
