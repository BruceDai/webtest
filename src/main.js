'use strict';

// const {spawnSync} = require('child_process');
const {stringify} = require('csv-stringify');
const fs = require('fs');
const os = require('os');
const path = require('path');


const runBenchmark = require('./benchmark.js');
const util = require('./util.js');
const config = require('./config.js');
// const report = require('./report.js');
const upload = require('./upload.js');


// util.args =
//     yargs.usage('node $0 [args]')
//         .strict()
//         .option('benchmark', {
//           type: 'string',
//           describe: 'benchmark to run, split by comma',
//         })
//         .option('benchmark-json', {
//           type: 'string',
//           describe: 'benchmark json',
//           default: 'benchmark-s.json',
//         })
//         .option('benchmark-url', {
//           type: 'string',
//           describe: 'benchmark url to test against',
//         })
//         .option('benchmark-url-args', {
//           type: 'string',
//           describe: 'extra benchmark url args',
//         })
//         .option('browser', {
//           type: 'string',
//           describe:
//               'browser specific path, can be chrome_canary, chrome_dev, edge_canary or edge_dev',
//           default: 'chrome_canary',// 'chrome_canary,edge_canary'
//         })
//         .option('browser-args', {
//           type: 'string',
//           describe: 'extra browser args',
//         })
//         .option('cleanup-user-data-dir', {
//           type: 'boolean',
//           describe: 'cleanup user data dir',
//         })
//         .option('email', {
//           alias: 'e',
//           type: 'string',
//           describe: 'email to',
//         })
//         .option('new-context', {
//           type: 'boolean',
//           describe: 'start a new context for each test',
//         })
//         .option('performance-backend', {
//           alias: 'b',
//           type: 'string',
//           describe: 'backend for performance, split by comma',
//           default: 'wasm', // 'webnn-cpu,wasm'
//         })
//         .option('run-times', {
//           type: 'number',
//           describe: 'run times',
//         })
//         .option('server-info', {
//           type: 'boolean',
//           describe: 'get server info and display it in report',
//         })
//         .option('skip-config', {
//           type: 'boolean',
//           describe: 'skip config',
//         })
//         .option('target', {
//           type: 'string',
//           describe:
//               'test target, split by comma, can be conformance, performance, upload and so on.',
//           default: 'performance',
//         })
//         .option('timestamp', {
//           type: 'string',
//           describe: 'timestamp format, day or second',
//           default: 'second',
//         })
//         .option('upload', {
//           type: 'boolean',
//           describe: 'upload result to server',
//         })
//         .option('warmup-times', {
//           type: 'number',
//           describe: 'warmup times',
//         })
//         .example([
//           // ['node $0 --email a@intel.com;b@intel.com // Send report to emails'],
//           [
//             // 'node $0 --target performance --benchmark-json benchmark.json --benchmark-url https://honry.github.io/tfjs/e2e/benchmarks/local-benchmark/index.html --run-times 3'
//             'node $0 --target performance --benchmark-json benchmark-s.json --benchmark-url https://honry.github.io/tfjs/e2e/benchmarks/local-benchmark/index.html'
//           ],
//         ])
//         .help()
//         .wrap(180)
//         .argv;

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
    for (let browser of settings.browser) {
      for (let backend of settings.backend) {
        for (let numThreads of settings.numThreads) {
          performanceColumns[`${browser}${backend}${numThreads}`] =
              `${browser.toUpperCase()} ${version} ${backend.toUpperCase()} MT-${numThreads}`;
          }
        }
        if (multiBackend) {
          // comparison column for CPU
          if (settings.backend.includes('webnn-cpu') &&
              settings.backend.includes('wasm')) {
            for (let numThreads of settings.numThreads) {
              performanceColumns[`compare${browser}${numThreads}`] =
                  `${browser.toUpperCase()} ${version} WEBNN-CPU vs WASM MT-${numThreads}`;
            }
          }
        }
    }
    const performanceData = [];
    for (let solution in results.performance) {
      let itemData = [];
      let solutionObj = results.performance[solution];
      for (let model in solutionObj) {
        itemData = [solution, model];
        let modelObj = solutionObj[model];
        for (let browser in modelObj) {
          let browserObj = modelObj[browser];
          for (let backend in browserObj) {
            itemData = itemData.concat(browserObj[backend]);
          }
          if (multiBackend) {
            // comparison column for CPU
            if (settings.backend.includes('webnn-cpu') &&
                settings.backend.includes('wasm')) {
              let cpuResults = browserObj['webnn-cpu'];
              let wasmResults = browserObj['wasm'];
              let compareCpuWasm = [];
              wasmResults.forEach((value, index) => {
                let cpuValue = cpuResults[index];
                if (value === 'NA' || cpuValue === 'NA') {
                  compareCpuWasm.push('NA');
                } else {
                  compareCpuWasm.push((value/cpuValue).toFixed(2));
                }
              })
              itemData = itemData.concat(compareCpuWasm);
            }
          }
        }
        performanceData.push(itemData);
      }
    }
    stringify(performanceData, {header: true, columns: performanceColumns},
        (_, output) => {
          // Save results into CSV file, and upload CSV file, send report
          const csvFile = path.join(util.timestampDir, `${util.timestamp}.csv`);
          fs.writeFile(csvFile, output, () => {
            console.log(`Save performance results into ${csvFile}`);
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

  let results = {};

  util.log(`Start to run performance tests (runTimes=${settings.runTimes})`);
  results.performance = await runBenchmark();

  // results.performance = {
  //   'Object detection': {
  //     'EfficientDet-Lite0 (float 32)': {
  //       'chrome': {
  //         'webnn-cpu': [29.4,19.8],
  //         'wasm': [87.2,46.9]
  //       },
  //       'edge': {
  //         'webnn-cpu': [26.7,33],
  //         'wasm': [80.1,45.7]
  //       }
  //     }
  //   },
  //   'Image classification': {
  //     'EfficientNet-Lite0 (float 32)': {
  //       'chrome': {
  //         'webnn-cpu': [9.8,7.1],
  //         'wasm': [35,22.2]
  //       },
  //       'edge': {
  //         'webnn-cpu': [9.9,11.9],
  //         'wasm': [35.6,25]
  //       }
  //     },
  //     'EfficientNet-Lite2 (float 32)': {
  //       'chrome': {
  //         'webnn-cpu': [20.6,13.2],
  //         'wasm': [68.3,38.9]
  //       },
  //       'edge': {
  //         'webnn-cpu': [21.1,15.2],
  //         'wasm': [72.7,37.6]
  //       }
  //     }
  //   }
  // };
  processResults(results);
}

main();
