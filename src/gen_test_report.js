"use strict";

const fs = require('fs');
const path = require('path');
const os = require('os');
const competitionList = require('../competition.json');
const fsPromises = fs.promises;

/*
* Draw table header
* @param {String}, type, one of ["summary", "details"]
*/
function drawTableHeader(type, basedResult, preResult, competitionResult, intelArch) {
  let preCpu = "", preOs = "", preBrowser = "", vsPre = "";
  let comCpu = "", comOs = "", comBrowser = "", vsCom = "</tr>";
  let firstCol = "Workloads";
  let extendCpuInfo = intelArch;
  if (type !== "summary")
    firstCol = basedResult.workload;
  if (intelArch !== "")
    extendCpuInfo = ` (${intelArch})`;
  if (preResult !== "") {
    preCpu = `<th>${preResult.device_info.CPU + extendCpuInfo}</th>`;
    preOs = `<th>${preResult.device_info.OS}</th>`;
    preBrowser = `<th>${preResult.device_info.Browser}</th>`;
    vsPre = `<th rowspan='3'>Chrome vs. previous${extendCpuInfo}</th>`;
  }
  if (competitionResult !== "") {
    comCpu = `<th>${competitionResult.device_info.CPU}</th>`;
    comOs = `<th>${competitionResult.device_info.OS}</th>`;
    comBrowser = `<th>${competitionResult.device_info.Browser}</th>`;
    vsCom = `<th rowspan='3'>${intelArch} vs. AMD</th></tr>`;
  }
  const tableHeader = `<tr><th rowspan="3">${firstCol}</th>\
                     ${preCpu + comCpu}<th>${basedResult.device_info.CPU + extendCpuInfo}</th>${vsPre + vsCom}\
                 <tr>${preOs + comOs}<th>${basedResult.device_info.OS}</th></tr>\
                 <tr>${preBrowser + comBrowser}<th>${basedResult.device_info.Browser}</th></tr>`;
  return tableHeader;
}

function drawRoundsHeader(basedResult, competitionResult, intelArch) {
  let extendCpuInfo = intelArch;
  let comCol = "</tr>";
  let basedRoundCol = "<tr>", comRoundCol = "";
  const basedResultLength = basedResult.test_rounds.length;
  for (let i = 0; i < basedResultLength; i ++) {
    basedRoundCol += `<th>Round ${i + 1}</th>`;
  }
  if (intelArch !== "")
    extendCpuInfo = ` (${intelArch})`;
  let header = `<tr><th rowspan='2'>Workloads</th><th colspan='${basedResultLength}'>\
    ${basedResult.device_info.CPU + extendCpuInfo + " " + basedResult.device_info.Browser}</th>`;
  if(competitionResult !== "") {
    const comResultLength = competitionResult.test_rounds.length;
    for (let i = 0; i < comResultLength; i ++) {
      comRoundCol += `<th>Round ${i + 1}</th>`;
    }
    comCol = `<th colspan='${comResultLength}'>\
      ${competitionResult.device_info.CPU + " " + competitionResult.device_info.Browser}</th></tr>`;
  }
  header = header + comCol + basedRoundCol + comRoundCol + "</tr>";
  return header;
}

function drawRoundsResult(basedResult, competitionResult) {
  let basedResultCol = `<tr><td>${basedResult.workload}</td>`;
  let comResultCol = "";
  const selectedStyle = "style='background-color: #4CAF50;'";
  for ( let i = 0; i < basedResult.test_rounds.length; i++ ) {
    if (i === basedResult.selected_round)
      basedResultCol += `<td ${selectedStyle}>${basedResult.test_rounds[i].scores["Total Score"]}</td>`;
    else
      basedResultCol += `<td>${basedResult.test_rounds[i].scores["Total Score"]}</td>`;
  }
  if (competitionResult !== "") {
    for ( let i = 0; i < competitionResult.test_rounds.length; i++ ) {
      if (i === competitionResult.selected_round)
        comResultCol += `<td ${selectedStyle}>${competitionResult.test_rounds[i].scores["Total Score"]}</td>`;
      else
        comResultCol += `<td>${competitionResult.test_rounds[i].scores["Total Score"]}</td>`;
    }
  }
  const resultCol = basedResultCol + comResultCol + "</tr>";
  return resultCol;
}

function drawResultTable(basedResult, preResult, competitionResult, intelArch) {
  let summaryCol = "";
  let resultTable = "<table>" + drawTableHeader("details", basedResult, preResult, competitionResult, intelArch);

  for (const key of Object.keys(basedResult.test_result)) {
    const basedValue = basedResult.test_result[key];
    // Get info from preResult
    let preValue = "", preCol = "", vsPreCol = "";
    if (preResult !== "") {
      preValue = preResult.test_result[key];
      preCol = `<td>${preValue}</td>`;
      vsPreCol = drawCompareResult(basedValue, preValue);
      if (basedResult.workload === "WebXPRT3" && key !== "Total Score") {
        vsPreCol =  drawCompareResult(preValue, basedValue);
      }
    }
    // Get info from competitionResult
    let competitionCol = "", vsCompetitionCol = "", competitionValue = "";
    if (competitionResult !== "") {
      competitionValue = competitionResult.test_result[key];
      vsCompetitionCol = drawCompareResult(basedValue, competitionValue);
      if (basedResult.workload === "WebXPRT3" && key !== "Total Score") {
        vsCompetitionCol =  drawCompareResult(competitionValue, basedValue);
      }
      competitionCol = `<td>${competitionValue}</td>`;
    }
    // Draw summaryCol and resultTable
    if (key == "Total Score")
      summaryCol = `<tr><td>${basedResult.workload}</td>${preCol + competitionCol}<td>${basedValue}</td>${vsPreCol + vsCompetitionCol}</tr>`;
    resultTable += `<tr><td>${key}</td>${preCol + competitionCol}<td>${basedValue}</td>${vsPreCol + vsCompetitionCol}</tr>`;
  }

  return {"all":`${resultTable}</table>`, "summaryCol": summaryCol};
}

async function findPreTestResult(resultPath) {
  const dir = await fs.promises.opendir(path.dirname(resultPath));
  // Gets cpu info from the test report file, e.g. Intel-Core-i5-8350U
  const currentCPU = path.basename(resultPath).split('_')[1];
  if (dir.length == 0)
    return Promise.reject("Error: no test result found!");
  else if (dir.length == 1)
    return Promise.resolve("");
  else {
    let dirents = [];
    for await (const dirent of dir) {
      // We only compare same CPU versions
      if (currentCPU === dirent.name.split('_')[1])
        dirents.push(dirent.name);
    }
    if (dirents.length > 1) {
      const comparedPath = path.join(path.dirname(resultPath), dirents.sort().reverse()[1]);
      console.log("Found the previus test result: ", comparedPath);
      const rawComparedData = await fsPromises.readFile(comparedPath, 'utf-8');
      const preResult = JSON.parse(rawComparedData);
      console.log("compared result: ", preResult);
      return Promise.resolve(preResult);
    } else {
      return Promise.resolve("");
    }
  }
}

async function findCompetitionResult(resultPath) {
  const dir = await fs.promises.opendir(path.dirname(resultPath));
  const basedFileName = path.basename(resultPath).split('_');
  const basedCpuInfo = basedFileName[1];
  const basedChromeVersion = basedFileName[2];

  let matchedAmdInfo = "";
  if (competitionList[basedCpuInfo])
    matchedAmdInfo = competitionList[basedCpuInfo].competition;
  else
    return Promise.reject(`Error: does not found matched Intel CPU info: (${basedCpuInfo}) in competition.json`);

  let amdDirents = [];
  for await (const dirent of dir) {
    // We only find matched AMD cpu
    if (dirent.name.split('_')[1].includes(matchedAmdInfo) && dirent.name.split('_')[2].includes(basedChromeVersion))
      amdDirents.push(dirent.name);
  }
  if (amdDirents.length == 0) {
    return Promise.resolve("");
  } else {
    // Find AMD test result with latest execution time
    const amdPath = path.join(path.dirname(resultPath), amdDirents.sort().reverse()[0]);
    console.log("Found the previus test result: ", amdPath);
    const rawComparedData = await fsPromises.readFile(amdPath, 'utf-8');
    const amdResult = JSON.parse(rawComparedData);
    console.log("Competition result: ", amdResult);
    return Promise.resolve(amdResult);
  }
}

// Draw comparison result with style
// green for result >= 100%, yellow for 99.99% < result < 95%, red for result <= 95%
function drawCompareResult(basedValue, comparedValue) {
  const result = Math.round(((basedValue / comparedValue) * 100) * 100) / 100;
  let resultStyle = "";
  if (result >= 100)
    resultStyle = "#4CAF50";
  else if (result < 100 && result > 95)
    resultStyle = "#D1B100";
  else
    resultStyle = "red";
  return `<td style="color:${resultStyle}">${result}%</td>`;
}

function drawDeviceInfoTable(result) {
  let deviceInfoTable = "<table>";
  for (const key in result.device_info) {
    deviceInfoTable += `<tr><td>${key}</td><td>${result.device_info[key]}</td></tr>`;
  }
  return `${deviceInfoTable}</table>`;
}

/*
* Generate test report as html
* @param: {Object}, resultPaths, an object reprensents for test result path
* e.g.
* {
*   "Speedometer2": path.join(__dirname, "../results/Speedometer2/202005261300_Intel-Core-i5-8350U_Chrome-85.0.4154.0.json"),
*	  "WebXPRT3": path.join(__dirname, "../results/WebXPRT3/202005261555_Intel-Core-i5-8350U_Chrome-85.0.4154.0.json")
* }
*/
async function genTestReport(resultPaths) {
  console.log("********** Generate test report as html **********");
  // Get test result table
  let resultTables = "";
  let summaryTable = "<table>";
  let roundsTable = "<table>";
  let basedResult;
  let intelArch = "";
  let flag = false;
  for (const key in resultPaths) {
    const resultPath = resultPaths[key];

    // Get basedResult
    if (!fs.existsSync(resultPath)) {
      return Promise.reject(`Error: file: ${resultPath} does not exist!`);
    } else {
      const rawData = await fsPromises.readFile(resultPath, 'utf-8');
      basedResult = JSON.parse(rawData);
      console.log("based result: ", basedResult);
    }

    // Draw result table
    let competitionResult = "";
    // Find previous test result
    const preResult = await findPreTestResult(resultPath);
    // Try to find competition test result only when based test result is running on Intel
    if (basedResult.device_info.CPU.includes('Intel')) {
      // Find competition test result
      competitionResult = await findCompetitionResult(resultPath);
      const basedCpuInfo = path.basename(resultPath).split('_')[1];
      intelArch = competitionList[basedCpuInfo].arch;
    }
    if(!flag) {
      summaryTable += drawTableHeader("summary", basedResult, preResult, competitionResult, intelArch);
      roundsTable += drawRoundsHeader(basedResult, competitionResult, intelArch);
    }
    const resultTable = drawResultTable(basedResult, preResult, competitionResult, intelArch);
    resultTables += `${resultTable.all}<br>`;
    summaryTable += resultTable.summaryCol;
    roundsTable += drawRoundsResult(basedResult, competitionResult);
    flag = true;
  }
  summaryTable += "</table><br>";
  roundsTable += "</table><br><br>";
  // Get device info table
  const deviceInfoTable = drawDeviceInfoTable(basedResult);
  // Define html style
  const htmlStyle = "<style> \
		* {font-family: Calibri (Body);} \
	  table {border-collapse: collapse;} \
	  table, td, th {border: 1px solid black;} \
	  th {background-color: #0071c5; color: #ffffff; font-weight: normal;} \
		</style>";
  // Composite html body
  const html = htmlStyle + "<b>Summary:</b>" + summaryTable + roundsTable + "<b>Details:</b>"
               + resultTables + "<br><br>" + "<b>Device Info:</b>" + deviceInfoTable;
  console.log("**Generated html: ", html);
  return Promise.resolve(html);
}

module.exports = genTestReport;