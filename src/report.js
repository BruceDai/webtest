'use strict';
const fs = require('fs');
const {parse} = require('csv-parse');
const nodemailer = require('nodemailer');
const path = require('path');

const util = require('./util.js');
const config = require('./config.js');

const sendMail = async (htmlContent, csvFile) => {
  const mailService = util.settings.mailService;

  const transporter = nodemailer.createTransport({
    host: mailService.host,
    port: mailService.port,
    secure: false,
    auth: false,
  });

  transporter.verify((error) => {
    if (error) {
      util.log('transporter error: ', error);
    } else {
      util.log('Email was sent!');
    }
  });

  await transporter.sendMail({
    from: mailService.from,
    to: mailService.to,
    subject: `WebNN Performance Tests for ${util.platform.toUpperCase()}`,
    html: htmlContent,
    attachments: [{
      filename: `perf_${util.platform}.csv`,
      path: csvFile,
    }],
  });
  return Promise.resolve();
};

const report = async (csvFile) => {
  const settings = util.settings;
  const results = await new Promise((resolve, reject) => {
    const data = [];
    fs.createReadStream(csvFile)
        .pipe(parse({delimiter: ','}))
        .on('data', (row) => {
          data.push(row);
        })
        .on('error', reject)
        .on('end', () => {
          console.log(`Done parsing ${csvFile}`);
          resolve(data);
        });
  });
  // performance data column offset for different browser of CSV results
  const offset = [];
  const columnNumberByBrowser = 3 * settings.numThreads.length;
  for (let i = 0; i< settings.browser.length; ++i) {
    offset.push(2 + i * columnNumberByBrowser);
  }

  let performanceTable = '';
  for (let i = 0; i< settings.browser.length; ++i) {
    for (let j = 0; j < results.length; ++j) {
      if (j === 0) {
        // prepare table head part
        performanceTable += '<table><thead><tr><th>Solution</th><th>Model</th>';
        const titlePart = results[0];
        for (let k = 0; k < columnNumberByBrowser; ++k) {
          performanceTable += `<th>${titlePart[k + offset[i]]}</th>`;
        }
        performanceTable += '</tr></thead>';
      } else {
        // prepare table body part
        const result = results[j];
        performanceTable +=
            `<tbody><tr><td>${result[0]}</td><td>${result[1]}</td>`;
        for (let m = 0; m < columnNumberByBrowser; ++m) {
          performanceTable += `<td>${result[m + offset[i]]}</td>`;
        }
        performanceTable += '</tr></tbody>';
      }
    }
    performanceTable += '</table><br>';
  }

  let environmentTable =
      '<table><thead><tr><th>Category</th><th>Information</th></tr>';

  let benchmarkUrl = '';
  let browserArgs = '';
  for (const backend of settings.backend) {
    benchmarkUrl += `https://${settings.benchmarkServer.ip}:` +
      `${settings.benchmarkServer.port[backend]}/local-benchmark/` +
      `index.html`;
    browserArgs += settings.browserArgs[backend].join(',');
    if (backend === 'wasm') {
      benchmarkUrl += ' for WASM backend';
      browserArgs += ' for WASM backend';
    }
    benchmarkUrl += '<br>';
    browserArgs += '<br>';
  }
  environmentTable +=
      `<tbody><tr><td>benchmark URL</td><td>${benchmarkUrl}</td></tr>`;

  await config();

  for (const category
    of ['cpuName', 'gpuName', 'gpuDriverVersion', 'hostname', 'osVersion']) {
    environmentTable +=
          `<tr><td>${category}</td><td>${util[category]}</td></tr>`;
  }

  let chromeVersion;
  let edgeVersion;
  if (util.platform == 'win32') {
    chromeVersion = `Google Chrome ${util['chromeVersion']} canary`;
    edgeVersion = `Microsoft Edge ${util['edgeVersion']} canary`;
  } else if (util.platform == 'linux') {
    chromeVersion = util['chromeVersion'];
    edgeVersion = util['edgeVersion'];
  }
  environmentTable += `<tr><td>Chrome</td><td>${chromeVersion}</td></tr>`;
  environmentTable += `<tr><td>Edge</td><td>${edgeVersion}</td></tr>`;
  environmentTable +=
      `<tr><td>browser args</td><td>${browserArgs}</td></tr>`;
  environmentTable += '</tbody></table><br>';

  const style = '<style>' +
    '* {font-family: Calibri (Body);}' +
    'table {border-collapse: collapse;}' +
    'table, td, th {border: 1px solid black; vertical-align: top;}' +
    'th {background-color: #0071c5; color: #ffffff; font-weight: normal;}' +
    '</style>';

  const content = style + environmentTable + performanceTable;

  fs.writeFileSync(
      path.join(util.timestampDir, `${util.timestamp}.html`), content);
  await sendMail(content, csvFile);
};

module.exports = report;
