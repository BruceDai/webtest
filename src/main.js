'use strict';

const {stringify} = require('csv-stringify');
const fs = require('fs');
const path = require('path');


const runBenchmark = require('./benchmark.js');
const util = require('./util.js');
const report = require('./report.js');
const upload = require('./upload.js');

const padZero = (str) => {
  return ('0' + str).slice(-2);
};

const getTimestamp = (format = 'second') => {
  const date = new Date();
  let timestamp = date.getFullYear() + padZero(date.getMonth() + 1) +
      padZero(date.getDate());
  if (format === 'second') {
    timestamp += padZero(date.getHours()) + padZero(date.getMinutes()) +
        padZero(date.getSeconds());
  }
  return timestamp;
};

const processResults = (results) => {
  const version = util.platform == 'win32' ? 'Canary' : 'Dev';
  const settings = util.settings;
  if ('performance' in results) {
    const performanceColumns = {
      solution: 'Solution',
      model: 'Model',
    };
    const multiBackend = settings.backend.length > 1 ? true : false;
    // CSV header
    for (const browser of settings.browser) {
      for (const backend of settings.backend) {
        for (const numThreads of settings.numThreads) {
          performanceColumns[`${browser}${backend}${numThreads}`] =
              `${browser.toUpperCase()} ${version} ${backend.toUpperCase()}` +
              ` MT-${numThreads}`;
        }
      }
      if (multiBackend) {
        // comparison column for CPU
        if (settings.backend.includes('webnn-cpu') &&
              settings.backend.includes('wasm')) {
          for (const numThreads of settings.numThreads) {
            performanceColumns[`compare${browser}${numThreads}`] =
                  `${browser.toUpperCase()} ${version} WEBNN-CPU vs` +
                  ` WASM MT-${numThreads}`;
          }
        }
      }
    }
    const performanceData = [];
    for (const solution in results.performance) {
      if (Object.hasOwn(results.performance, solution)) {
        let itemData = [];
        const solutionObj = results.performance[solution];
        for (const model in solutionObj) {
          if (Object.hasOwn(solutionObj, model)) {
            itemData = [solution, model];
            const modelObj = solutionObj[model];
            for (const browser in modelObj) {
              if (Object.hasOwn(modelObj, browser)) {
                const browserObj = modelObj[browser];
                for (const backend in browserObj) {
                  if (Object.hasOwn(browserObj, backend)) {
                    itemData = itemData.concat(browserObj[backend]);
                  }
                }
                if (multiBackend) {
                  // comparison column
                  if (settings.backend.includes('webnn-cpu') &&
                      settings.backend.includes('wasm')) {
                    const cpuResults = browserObj['webnn-cpu'];
                    const wasmResults = browserObj['wasm'];
                    const compareCpuWasm = [];
                    wasmResults.forEach((value, index) => {
                      const cpuValue = cpuResults[index];
                      if (value === 'NA' || cpuValue === 'NA') {
                        compareCpuWasm.push('NA');
                      } else {
                        compareCpuWasm.push((value / cpuValue).toFixed(2));
                      }
                    });
                    itemData = itemData.concat(compareCpuWasm);
                  }
                }
              }
            }
            performanceData.push(itemData);
          }
        }
      }
    }
    stringify(performanceData, {header: true, columns: performanceColumns},
        (_, output) => {
          const csvFile = path.join(util.timestampDir, `${util.timestamp}.csv`);
          fs.writeFile(csvFile, output, async () => {
            util.log(`Save performance results into ${csvFile}`);
            await report(csvFile);
            upload();
          });
        });
  }
};

const main = async () => {
  // parse configurations from setting.json
  const settings = util.parseJsonFile('settings.json');
  util.settings = settings;

  util.timestamp = getTimestamp();
  util.timestampDir = path.join(util.outDir, util.timestamp);
  util.ensureDir(util.timestampDir);
  const logFile = path.join(util.timestampDir, `${util.timestamp}.log`);
  console.log(`Save log file as ${logFile}`);
  util.setLogFile(logFile);
  if (fs.existsSync(logFile)) {
    fs.truncateSync(logFile, 0);
  }

  const results = {};
  util.log(`Start to run performance tests (runTimes=${settings.runTimes})`);
  results.performance = await runBenchmark();

  processResults(results);
};

main();
