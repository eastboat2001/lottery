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

test("admin roster and record tables include participant names", () => {
  assert.match(renderer, /renderAdminTable\(\["姓名",\s*"工号"\]/);
  assert.match(renderer, /renderAdminTable\(\s*\[\s*"姓名",\s*"工号",\s*"奖品",\s*"时间"\s*\]/);
  assert.match(renderer, /participantsFromWorkbook/);
  assert.doesNotMatch(indexHtml, /请输入或扫描工号/);
});

test("prize settings rerender does not reset unsaved draft edits", () => {
  const renderPrizeSettingsBody = renderer.match(/function renderPrizeSettings\(\) \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.ok(renderPrizeSettingsBody, "missing renderPrizeSettings");
  assert.doesNotMatch(renderPrizeSettingsBody, /state\.prizeDrafts\s*=\s*state\.snapshot\.prizes/);
});

test("removing a prize confirms and persists immediately instead of staying draft-only", () => {
  assert.match(renderer, /if \(action === "remove-prize"\)/);
  assert.match(renderer, /countValidPrizeDrafts\(state\.prizeDrafts\) <= MIN_PRIZE_COUNT/);
  assert.match(renderer, /至少保留 1 个奖品/);
  assert.match(renderer, /window\.confirm\(/);
  assert.match(renderer, /await\s+savePrizeSettings\("奖品已删除",\s*false\)/);
  assert.doesNotMatch(renderer, /state\.prizeDrafts\.splice\([^;]+;\s*renderPrizeSettings\(\);\s*return;/);
});

test("prizes without uploaded images render as text instead of fallback gift images", () => {
  assert.match(renderer, /function renderPrizeVisual/);
  assert.match(renderer, /class="prize-text-visual"/);
  assert.doesNotMatch(renderer, /function prizeImage\(prize\) \{[\s\S]*fallbackImages\[prize\.name\]/);
});

test("prize settings copy no longer references the old nine-grid layout", () => {
  assert.doesNotMatch(renderer, /九宫格/);
  assert.match(renderer, /\$\{MIN_PRIZE_COUNT\}-\$\{MAX_PRIZE_COUNT\} 种奖品/);
  assert.doesNotMatch(renderer, /右侧展示区会自动调整展示密度/);
});

test("new prize rows are inserted at the top without delayed focus stealing", () => {
  assert.match(renderer, /if \(action === "add-prize"\)/);
  assert.match(renderer, /state\.prizeDrafts\.length >= MAX_PRIZE_COUNT/);
  assert.match(renderer, /最多配置 12 个奖品/);
  assert.match(renderer, /state\.prizeDrafts\.unshift\(\{ name: "", description: "", remainingQty: 0, imagePath: "", imageUrl: "" \}\)/);
  assert.match(renderer, /scrollPrizeSettingsTop\(\)/);
  assert.doesNotMatch(renderer, /focusPrizeNameInput\(0\)/);
  assert.doesNotMatch(renderer, /state\.prizeDrafts\.push\(\{ name: "", remainingQty: 0, imagePath: "", imageUrl: "" \}\)/);
});

test("saving prize settings requires at least one named prize", () => {
  assert.match(renderer, /const MIN_PRIZE_COUNT = 1/);
  assert.match(renderer, /function validatePrizeDraftsForSave/);
  assert.match(renderer, /validPrizes\.length < MIN_PRIZE_COUNT/);
  assert.match(renderer, /请至少配置 1 个有效奖品/);
});

test("prize settings include a description field for reward details", () => {
  assert.match(renderer, /data-prize-field="description"/);
  assert.match(renderer, />奖品描述</);
  assert.match(renderer, /description:\s*String\(prize\?\.description/);
  assert.match(renderer, /class="prize-description"/);
});

test("front prize card renders a staged certificate visual", () => {
  assert.match(renderer, /function prizeCertificateDetails/);
  assert.match(renderer, /class="prize-card-hero"/);
  assert.match(renderer, /class="prize-certificate/);
  assert.match(renderer, /class="prize-certificate-amount"/);
  assert.match(renderer, /class="prize-stage-base"/);
});

test("uploaded prize images use the staged certificate image treatment", () => {
  assert.match(renderer, /has-image/);
  assert.match(renderer, /class="prize-certificate-image"/);
  assert.match(renderer, /imageSrc\s*\?/);
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
