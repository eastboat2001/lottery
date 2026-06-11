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

const css = fs.readFileSync("app/styles.css", "utf8");

function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing CSS block for ${selector}`);
  return match[1];
}

test("prize board rows can shrink inside the outer border", () => {
  const prizeBoard = block(".prize-board");

  assert.match(prizeBoard, /grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(prizeBoard, /overflow:\s*hidden/);
});

test("prize cells do not force the grid beyond the board height", () => {
  const prizeCard = block(".prize-card");
  const startButton = block(".start-button");

  assert.match(prizeCard, /min-height:\s*0/);
  assert.match(startButton, /min-height:\s*0/);
});

test("text-only prize visual is centered in the main prize card image slot", () => {
  const prizeCardVisual = block(".prize-card .prize-text-visual");

  assert.match(prizeCardVisual, /align-self:\s*center/);
  assert.match(prizeCardVisual, /justify-self:\s*center/);
});

test("running prize highlight uses a deeper yellow cursor", () => {
  const activePrizeCard = block(".prize-card.active");

  assert.match(activePrizeCard, /border:\s*5px solid #ffb000/);
  assert.match(activePrizeCard, /background:\s*linear-gradient\(135deg,\s*#ffe08a 0%,\s*#fff0bd 100%\)/);
});

test("sold out prize cards use a prominent unavailable color", () => {
  const soldOutPrizeCard = block(".prize-card.sold-out");
  const soldOutText = block(".prize-card.sold-out h3,\n.prize-card.sold-out p");
  const soldOutVisual = block(".prize-card.sold-out .prize-text-visual");
  const soldOutLabel = block(".sold-out-label");

  assert.match(soldOutPrizeCard, /border-color:\s*#ff6b57/);
  assert.match(soldOutPrizeCard, /background:\s*linear-gradient\(135deg,\s*#fff0ec 0%,\s*#ffd9d2 100%\)/);
  assert.match(soldOutText, /color:\s*#9f2d22/);
  assert.match(soldOutVisual, /border-color:\s*rgba\(255,\s*107,\s*87,\s*0\.45\)/);
  assert.match(soldOutVisual, /color:\s*#9f2d22/);
  assert.match(soldOutLabel, /color:\s*#c93524/);
});

test("toast appears as a prominent top-center overlay", () => {
  const toast = block(".toast");
  const visibleToast = block(".toast.visible");

  assert.match(toast, /top:\s*86px/);
  assert.match(toast, /left:\s*50%/);
  assert.match(toast, /z-index:\s*9999/);
  assert.match(toast, /text-align:\s*center/);
  assert.match(toast, /background:\s*linear-gradient/);
  assert.match(toast, /transform:\s*translate\(-50%,\s*-10px\)/);
  assert.match(visibleToast, /transform:\s*translate\(-50%,\s*0\)/);
  assert.doesNotMatch(toast, /bottom:\s*72px/);
  assert.doesNotMatch(toast, /right:\s*24px/);
});

test("right column can shrink instead of flowing under the footer", () => {
  const sideColumn = block(".side-column");
  const recordsPanel = block(".records-panel");
  const recordsTableWrap = block(".records-table-wrap");
  const recordsPanelBody = block(".records-panel tbody");

  assert.match(sideColumn, /grid-template-rows:\s*minmax\(0,\s*0\.9fr\)\s*minmax\(0,\s*1\.1fr\)/);
  assert.match(sideColumn, /overflow:\s*hidden/);
  assert.match(recordsPanel, /overflow:\s*hidden/);
  assert.match(recordsTableWrap, /flex:\s*1/);
  assert.match(recordsTableWrap, /min-height:\s*0/);
  assert.match(recordsPanelBody, /overflow-y:\s*auto/);
});

test("result panel content can shrink without clipping the prize prompt", () => {
  const resultPanel = block(".result-panel");
  const resultImage = block("#resultImage");
  const resultPrize = block(".result-prize");

  assert.match(resultPanel, /display:\s*grid/);
  assert.match(resultPanel, /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto\s+auto/);
  assert.match(resultImage, /max-height:\s*100%/);
  assert.match(resultPrize, /font-size:\s*var\(--result-prize-size\)/);
});

test("admin dialog keeps a stable height while tab content scrolls", () => {
  const adminDialog = block(".admin-dialog");
  const adminDialogForm = block(".admin-dialog form");
  const adminTableWrap = block(".admin-table-wrap");

  assert.match(adminDialog, /height:\s*min\(760px,\s*calc\(100vh - 80px\)\)/);
  assert.match(adminDialog, /overflow:\s*hidden/);
  assert.match(adminDialogForm, /display:\s*flex/);
  assert.match(adminDialogForm, /min-height:\s*0/);
  assert.match(adminTableWrap, /flex:\s*1/);
  assert.match(adminTableWrap, /min-height:\s*0/);
  assert.match(adminTableWrap, /overflow:\s*auto/);
});

test("page layout avoids hard viewport minimums and can scroll on constrained screens", () => {
  const page = block("html,\nbody");

  assert.doesNotMatch(page, /min-width:\s*1120px/);
  assert.match(page, /min-width:\s*0/);
  assert.match(css, /body\s*\{[\s\S]*?overflow:\s*auto/);
});

test("layout defines responsive ratio breakpoints for narrow and short viewports", () => {
  assert.match(css, /@media\s*\(max-width:\s*1180px\)/);
  assert.match(css, /@media\s*\(max-height:\s*760px\)/);
  assert.match(css, /@media\s*\(max-aspect-ratio:\s*4\/3\)/);
  assert.match(css, /@media\s*\(max-width:\s*920px\)/);
});

test("main grid and prize cards use adaptive CSS variables", () => {
  const appShell = block(".app-shell");
  const mainGrid = block(".main-grid");
  const prizeBoard = block(".prize-board");
  const prizeCard = block(".prize-card");

  assert.match(appShell, /padding:\s*var\(--shell-pad-y\)\s+var\(--shell-pad-x\)/);
  assert.match(appShell, /gap:\s*var\(--shell-gap\)/);
  assert.match(mainGrid, /grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(var\(--side-column-min\),\s*1fr\)/);
  assert.match(prizeBoard, /padding:\s*var\(--board-pad\)/);
  assert.match(prizeBoard, /gap:\s*var\(--board-gap\)/);
  assert.match(prizeCard, /grid-template-columns:\s*var\(--prize-visual-col\)\s+minmax\(0,\s*var\(--prize-text-col\)\)/);
});

test("desktop prize card content is centered as an image and text group", () => {
  const prizeCard = block(".prize-card");
  const prizeText = block(".prize-card > div:last-child");

  assert.match(css, /--prize-text-col:\s*170px/);
  assert.match(prizeCard, /justify-content:\s*center/);
  assert.match(prizeCard, /justify-items:\s*stretch/);
  assert.match(prizeText, /max-width:\s*var\(--prize-text-col\)/);
  assert.match(prizeText, /min-width:\s*0/);
});

test("desktop employee input is width-capped and visually centered", () => {
  const inputRow = block(".input-row");

  assert.match(css, /--input-max-col:\s*760px/);
  assert.match(
    inputRow,
    /grid-template-columns:\s*var\(--input-label-col\)\s+minmax\(var\(--input-min-col\),\s*var\(--input-max-col\)\)\s+var\(--input-label-col\)/,
  );
  assert.match(inputRow, /justify-content:\s*center/);
});
