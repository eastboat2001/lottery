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
const styles = fs.readFileSync("app/styles.css", "utf8");
const main = fs.readFileSync("electron/main.mjs", "utf8");
const config = fs.readFileSync("app/config.js", "utf8");

test("admin dialog removes Excel template export entry point", () => {
  assert.doesNotMatch(indexHtml, /templateButton|导出Excel模板/);
  assert.doesNotMatch(renderer, /templateButton|createTemplate/);
  assert.doesNotMatch(main, /workbook:createTemplate|导出Excel模板/);
});

test("admin dialog exposes activity title settings", () => {
  assert.match(indexHtml, /id="activityTitle"/);
  assert.match(indexHtml, /id="footerActivityTitle"/);
  assert.match(indexHtml, /id="activityTitleInput"/);
  assert.match(indexHtml, /id="saveTitleButton"/);
  assert.match(renderer, /saveActivityTitle/);
});

test("admin tools are moved into password-protected admin UI", () => {
  assert.doesNotMatch(indexHtml, /class="actions-panel"/);
  assert.match(indexHtml, /id="adminLoginDialog"/);
  assert.match(indexHtml, /id="adminPasswordInput"/);
  assert.match(indexHtml, /id="resetButton"/);
  assert.match(indexHtml, />奖品设置</);
  assert.match(indexHtml, /id="rosterFileInput"/);
  assert.match(indexHtml, /id="prizeImageInput"/);
  assert.match(config, /adminPassword:\s*"123456"/);
  assert.doesNotMatch(renderer, /window\.lotteryApi/);
});

test("prize settings rerender does not reset unsaved draft edits", () => {
  const renderPrizeSettingsBody = renderer.match(/function renderPrizeSettings\(\) \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.ok(renderPrizeSettingsBody, "missing renderPrizeSettings");
  assert.doesNotMatch(renderPrizeSettingsBody, /state\.prizeDrafts\s*=\s*state\.snapshot\.prizes/);
});

test("removing a prize confirms and persists immediately instead of staying draft-only", () => {
  assert.match(renderer, /if \(action === "remove-prize"\)/);
  assert.match(renderer, /window\.confirm\(/);
  assert.match(renderer, /await\s+savePrizeSettings\("奖品已删除",\s*false\)/);
  assert.doesNotMatch(renderer, /state\.prizeDrafts\.splice\([^;]+;\s*renderPrizeSettings\(\);\s*return;/);
});

test("prizes without uploaded images render as text instead of fallback gift images", () => {
  assert.match(renderer, /function renderPrizeVisual/);
  assert.match(renderer, /class="prize-text-visual"/);
  assert.doesNotMatch(renderer, /function prizeImage\(prize\) \{[\s\S]*fallbackImages\[prize\.name\]/);
});

test("new prize rows are inserted at the top without delayed focus stealing", () => {
  assert.match(renderer, /if \(action === "add-prize"\)/);
  assert.match(renderer, /state\.prizeDrafts\.unshift\(\{ name: "", remainingQty: 0, imagePath: "", imageUrl: "" \}\)/);
  assert.match(renderer, /scrollPrizeSettingsTop\(\)/);
  assert.doesNotMatch(renderer, /focusPrizeNameInput\(0\)/);
  assert.doesNotMatch(renderer, /state\.prizeDrafts\.push\(\{ name: "", remainingQty: 0, imagePath: "", imageUrl: "" \}\)/);
});

test("admin prize inputs have robust click focus behavior", () => {
  assert.match(renderer, /addEventListener\("pointerdown",\s*handleAdminEditablePointer/);
  assert.match(renderer, /function handleAdminEditablePointer/);
  assert.match(renderer, /function queueAdminInputFocus/);
  assert.doesNotMatch(renderer, /requestAppFocus/);
  assert.doesNotMatch(main, /ipcMain|preload|window:focus/);

  const headerBlock = styles.match(/\.prize-settings-header\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.ok(headerBlock, "missing prize settings header styles");
  assert.doesNotMatch(headerBlock, /position:\s*sticky/);
  assert.doesNotMatch(headerBlock, /z-index/);
});
