'use strict';

const fs = require('fs');
const puppeteer = require('puppeteer-core');
const readline = require('readline');

const util = require('./util.js')

const run = async (browserName, modelNameOrURL, backend, numThreads, architecture) => {
  let modelUrl;
  let modelName;
  if (modelNameOrURL.startsWith('http')) {
    // test custom model by given model url
    modelUrl = modelNameOrURL;
  } else {
    // test existed models of TFJS E2E Benchmark
    modelName = modelNameOrURL;
  }

  const userDataDir = util.userDataDir[util.platform][browserName];
  if (util.settings.cleanUserDataDir) {
    // Cleanup user data dir
    util.ensureNoDir(userDataDir);
    fs.mkdirSync(userDataDir, {recursive: true});
  }

  const browser = await puppeteer.launch({
    args: util.settings.browserArgs[backend],
    executablePath: util.browserPath[util.platform][browserName],
    headless: false,
    ignoreHTTPSErrors: true,
    userDataDir: userDataDir,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(3000000); // 3 min

  // set numRuns by value of parameter 'run'
  await page.goto(`https://${util.settings.benchmarkServer.ip}:` +
      `${util.settings.benchmarkServer.port[backend]}/local-benchmark/` +
      `index.html?run=${util.settings.runTimes}`);

  // wait gui load
  const gui = await page.waitForSelector('.children', {timetout: 180000});

  // await util.sleep(10000);
  // const idForAriaLabelledby = {};
  // await page.$$eval('div.name', els => els.forEach(el => console.log(`8888888888888888888888 ${el.textContent}`)));

  // backend = tflite
  await page.select('[aria-labelledby="lil-gui-name-7"]', 'tflite');

  if (backend === 'wasm') {
    // click checkbox "webnn delegate" to not use webnn delegate
    await page.click('input[type="checkbox"]');
  }

  if (numThreads !== undefined) {
    // set numThreads
    await page.select(
      '[aria-labelledby="lil-gui-name-20"]', numThreads.toString());
  }

  if (modelUrl !== undefined) {
    // set models = 'custom'
    await page.select('[aria-labelledby="lil-gui-name-1"]', 'custom');

    // set modelUrl
    const modelUrlSelector =
        'input[placeholder="https://your-domain.com/model-path/model.json"]';
    await page.waitForSelector(modelUrlSelector)
              .then(() => page.type(modelUrlSelector, modelUrl));
  } else {
    // set models = modelName
    await page.select('[aria-labelledby="lil-gui-name-1"]', modelName);

    if (modelName === 'MobileNetV3') {
      // set architectures select
      await page.waitForSelector('[aria-labelledby="lil-gui-name-22"]', {timetout: 180000});
      await page.select('[aria-labelledby="lil-gui-name-22"]', architecture);
    }
  }

  // click 'Run benchmark' button
  await page.click('#lil-gui-name-8');

  await page.waitForSelector(
      `#timings > tbody > tr:nth-child(4)`, // Subsequent average
      {timeout: 600000});
  const value = await page.$eval(
        '#timings > tbody > tr:nth-child(4) > td:nth-child(2)',
        el => el.textContent);
  util.log(
      `[${new Date().toLocaleString()}] Result (numThreads=${numThreads}):` +
      ` Subsequent Average [${value}]`);

  await browser.close();

  // return number value part for later comparison
  return Promise.resolve(parseFloat(value.split(' ')[0]));
};

const runBenchmark = async () => {
  const settings = util.settings;
  const benchmarkTests = util.parseJsonFile('benchmark-s.json');
  let results = {};
  let index = 1;
  let subsequentAverageTime;

  for (let test of benchmarkTests) {
    results[test.solution] = {};
    util.log(`Performance test ${index}: ${test.solution}`);
    for (let model of test.model) {
      results[test.solution][model.name] = {};
      util.log(`[${new Date().toLocaleString()}] Test Model:`+
          ` [${model.name}](${model.modelUrl})`);
      for (let browser of settings.browser) {
        results[test.solution][model.name][browser] = {};
        for (let backend of settings.backend) {
          results[test.solution][model.name][browser][backend] = [];
          util.log(`Run ${browser.toUpperCase()} browser` +
              ` "${util.browserPath[util.platform][browser]}"` +
              ` by ${backend.toUpperCase()} backend` +
              ` using args "${settings.browserArgs[backend]}"`);
          for (let numThreads of settings.numThreads) {
            subsequentAverageTime = 'NA';
            for (let runTime = 1; runTime <= 5; ++runTime) {
              try {
                util.log(`Run ${model.name} model at time ${runTime}`);
                // kill target browser before testing
                util.killBrowser(browser);
                subsequentAverageTime =
                    await run(browser, model.modelUrl, backend, numThreads, model.architecture);
                break;
              } catch (error) {
                // util.log(`Failed to run ${model.name} model with error ${error.toString()}`);
                await util.sleep(30000);
                continue;
              }
            }
            results[test.solution][model.name][browser][backend].push(
                subsequentAverageTime);
            console.log(`results[${test.solution}][${model.name}][${browser}][${backend}] = [${results[test.solution][model.name][browser][backend]}]`);
            await util.sleep(util.settings['idelTime']);
          }
        }
      }
    }
  }
  index++;

  return Promise.resolve(results);
}

module.exports = runBenchmark;
