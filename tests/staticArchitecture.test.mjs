import assert from "node:assert/strict";
import fs from "node:fs";

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const indexHtml = fs.readFileSync("app/index.html", "utf8");
const renderer = fs.readFileSync("app/renderer.js", "utf8");
const main = fs.readFileSync("electron/main.mjs", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");
const packageConfig = JSON.parse(packageJson);
const installerScriptPath = "build/installer.nsh";

test("static page owns Excel and image file selection in the browser", () => {
  assert.match(indexHtml, /xlsx\.full\.min\.js/);
  assert.match(indexHtml, /id="rosterFileInput"/);
  assert.match(indexHtml, /id="prizeImageInput"/);
  assert.match(indexHtml, /type="file"/);
  assert.match(indexHtml, /src="\.\/renderer\.js"/);
  assert.doesNotMatch(indexHtml, /type="module"/);
  assert.equal(fs.existsSync("app/renderer.mjs"), false);
});

test("renderer uses browser storage and does not call Electron IPC APIs", () => {
  assert.match(renderer, /localStorage/);
  assert.match(renderer, /FileReader/);
  assert.match(renderer, /window\.XLSX/);
  assert.doesNotMatch(renderer, /window\.lotteryApi/);
  assert.doesNotMatch(renderer, /ipcRenderer|ipcMain|showOpenDialog|showSaveDialog/);
});

test("electron main is only a static shell with no workbook IPC or preload bridge", () => {
  assert.match(main, /loadFile\(projectPath\("app",\s*"index\.html"\)\)/);
  assert.doesNotMatch(main, /ipcMain|dialog|excelStore|preload|currentWorkbookPath|ensureDefaultWorkbook/);
  assert.doesNotMatch(packageJson, /"extraResources"/);
  assert.equal(fs.existsSync("electron/preload.mjs"), false);
  assert.equal(fs.existsSync("electron/excelStore.mjs"), false);
  assert.equal(fs.existsSync("config"), false);
});

test("windows nsis package uses generic installation names and ascii executable names", () => {
  assert.equal(packageConfig.name, "activity-lottery-web");
  assert.equal(packageConfig.build.productName, "活动抽奖系统");
  assert.equal(packageConfig.build.win.executableName, "activity-lottery-web");
  assert.equal(packageConfig.build.nsis.artifactName, "Activity-Lottery-Setup-${version}.${ext}");
  assert.equal(packageConfig.build.nsis.include, installerScriptPath);
  assert.doesNotMatch(packageConfig.description, /EHS/i);
});

test("windows nsis package can repair installs with a broken old uninstaller", () => {
  assert.equal(fs.existsSync(installerScriptPath), true);
  const installerScript = fs.readFileSync(installerScriptPath, "utf8");

  assert.match(installerScript, /!macro customUnInstallCheck/);
  assert.match(installerScript, /!macro customUnInstallCheckCurrentUser/);
  assert.match(installerScript, /Old uninstaller returned/);
});
