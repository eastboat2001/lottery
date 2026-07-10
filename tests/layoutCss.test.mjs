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

function rootBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `missing root CSS block for ${selector}`);
  return match[1];
}

test("front stage uses a resilient left control and right showcase layout", () => {
  const appShell = block(".app-shell");
  const controlPanel = block(".control-panel");
  const showcasePanel = block(".showcase-panel");
  const brandMark = block(".topline .brand-mark");
  const statsGrid = block(".stats-grid");

  assert.match(appShell, /grid-template-columns:\s*minmax\(280px,\s*0\.58fr\)\s+minmax\(0,\s*1\.9fr\)/);
  assert.match(appShell, /height:\s*100svh/);
  assert.match(appShell, /min-height:\s*620px/);
  assert.match(controlPanel, /display:\s*grid/);
  assert.match(controlPanel, /overflow:\s*hidden/);
  assert.match(showcasePanel, /min-width:\s*0/);
  assert.match(showcasePanel, /overflow:\s*hidden/);
  assert.match(brandMark, /color:\s*#ffffff/);
  assert.match(brandMark, /font-size:\s*clamp\(32px,\s*3vw,\s*48px\)/);
  assert.match(statsGrid, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test("main draw button is prominent without using the old input flow", () => {
  const drawButton = block(".draw-button");

  assert.match(drawButton, /border-radius:\s*999px/);
  assert.match(drawButton, /min-height:\s*96px/);
  assert.match(drawButton, /font-size:\s*var\(--draw-button-size\)/);
  assert.doesNotMatch(css, /#employeeInput|\.input-row/);
});

test("right panel can switch from prize display to winner display", () => {
  const prizeShowcase = block(".prize-showcase");
  const prizeCard = rootBlock(".prize-card");
  const singlePrizeShowcase = block(".prize-showcase.prize-count-1");
  const singlePrizeCard = block(".prize-showcase.prize-count-1 .prize-card");
  const prizeHero = block(".prize-showcase.prize-count-1 .prize-card-hero");
  const certificate = block(".prize-showcase.prize-count-1 .prize-certificate");
  const uploadedCertificate = block(".prize-certificate.has-image");
  const uploadedCertificateImage = block(".prize-certificate.has-image .prize-certificate-image");
  const stageBase = block(".prize-showcase.prize-count-1 .prize-stage-base");
  const spaciousShowcase = block(".prize-showcase.prize-density-spacious");
  const twoPrizeShowcase = block(".prize-showcase.prize-density-spacious.prize-count-2");
  const threePrizeShowcase = block(".prize-showcase.prize-density-spacious.prize-count-3");
  const multiPrizeCard = block(".prize-showcase:not(.prize-count-1) .prize-card");
  const multiPrizeHero = block(".prize-showcase:not(.prize-count-1) .prize-card-hero");
  const multiPrizeRings = block(".prize-showcase:not(.prize-count-1) .prize-stage-rings");
  const multiPrizeCertificate = block(".prize-showcase:not(.prize-count-1) .prize-certificate");
  const prizeCertificateLabel = block(".prize-certificate-label");
  const prizeCertificateAmount = block(".prize-certificate-amount");
  const multiPrizeCertificateIcon = block(".prize-showcase:not(.prize-count-1) .prize-certificate-icon");
  const multiPrizeCertificateIconBefore = block(".prize-showcase:not(.prize-count-1) .prize-certificate-icon::before");
  const multiPrizeCertificateIconAfter = block(".prize-showcase:not(.prize-count-1) .prize-certificate-icon::after");
  const multiPrizeUploadedCertificate = block(".prize-showcase:not(.prize-count-1) .prize-certificate.has-image");
  const multiPrizeStageBase = block(".prize-showcase:not(.prize-count-1) .prize-stage-base");
  const fivePrizeShowcase = block(".prize-showcase.prize-density-spacious.prize-count-5");
  const standardShowcase = block(".prize-showcase.prize-density-standard");
  const standardPrizeHero = block(".prize-showcase.prize-density-standard .prize-card-hero");
  const standardPrizeCertificate = block(".prize-showcase.prize-density-standard .prize-certificate");
  const compactShowcase = block(".prize-showcase.prize-density-compact");
  const compactPrizeHero = block(".prize-showcase.prize-density-compact .prize-card-hero");
  const compactPrizeCertificate = block(".prize-showcase.prize-density-compact .prize-certificate");
  const compactPrizeInfo = block(".prize-showcase.prize-density-compact .prize-info");
  const compactPrizeCopy = block(".prize-showcase.prize-density-compact .prize-description,\n.prize-showcase.prize-density-compact .prize-quota");
  const winnersShowcase = block(".winners-showcase");
  const winnerTicker = block(".winner-ticker");

  assert.match(prizeShowcase, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(210px,\s*1fr\)\)/);
  assert.match(singlePrizeShowcase, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(singlePrizeCard, /max-width:\s*1180px/);
  assert.match(singlePrizeCard, /background:\s*radial-gradient/);
  assert.match(prizeHero, /position:\s*relative/);
  assert.match(prizeHero, /min-height:\s*360px/);
  assert.match(certificate, /transform:\s*rotate\(-?6deg\)/);
  assert.match(certificate, /linear-gradient\(135deg/);
  assert.match(uploadedCertificate, /place-items:\s*center/);
  assert.match(uploadedCertificate, /background:\s*linear-gradient\(180deg/);
  assert.match(uploadedCertificateImage, /object-fit:\s*contain/);
  assert.match(uploadedCertificateImage, /max-width:\s*100%/);
  assert.match(stageBase, /box-shadow:/);
  assert.match(spaciousShowcase, /align-content:\s*stretch/);
  assert.match(twoPrizeShowcase, /grid-template-columns:\s*repeat\(2,\s*minmax\(320px,\s*520px\)\)/);
  assert.match(twoPrizeShowcase, /grid-auto-rows:\s*minmax\(420px,\s*520px\)/);
  assert.match(twoPrizeShowcase, /justify-content:\s*center/);
  assert.match(threePrizeShowcase, /grid-template-columns:\s*repeat\(3,\s*minmax\(260px,\s*1fr\)\)/);
  assert.match(threePrizeShowcase, /grid-auto-rows:\s*minmax\(380px,\s*500px\)/);
  assert.match(multiPrizeCard, /radial-gradient\(circle at 50% 20%/);
  assert.match(multiPrizeHero, /min-height:\s*clamp\(138px,\s*22vh,\s*210px\)/);
  assert.match(multiPrizeRings, /display:\s*block/);
  assert.match(multiPrizeCertificate, /transform:\s*rotate\(-?4deg\)/);
  assert.match(prizeCertificateLabel, /max-width:\s*calc\(100% - 64px\)/);
  assert.match(prizeCertificateAmount, /max-width:\s*calc\(100% - 58px\)/);
  assert.match(multiPrizeCertificateIcon, /width:\s*34px/);
  assert.match(multiPrizeCertificateIcon, /right:\s*18px/);
  assert.match(multiPrizeCertificateIconBefore, /height:\s*31px/);
  assert.match(multiPrizeCertificateIconAfter, /width:\s*34px/);
  assert.match(multiPrizeUploadedCertificate, /min-width:\s*176px/);
  assert.match(multiPrizeStageBase, /display:\s*block/);
  assert.match(fivePrizeShowcase, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(standardShowcase, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(standardPrizeHero, /min-height:\s*132px/);
  assert.match(standardPrizeCertificate, /width:\s*min\(205px,\s*76%\)/);
  assert.match(compactShowcase, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(compactPrizeHero, /min-height:\s*110px/);
  assert.match(compactPrizeCertificate, /width:\s*min\(178px,\s*74%\)/);
  assert.match(compactPrizeInfo, /gap:\s*3px/);
  assert.match(compactPrizeCopy, /font-size:\s*12px/);
  assert.match(prizeCard, /grid-template-columns:\s*1fr/);
  assert.match(prizeCard, /text-align:\s*center/);
  assert.match(css, /\.prize-showcase\.prize-density-spacious\s+\.prize-card/);
  assert.match(css, /\.prize-showcase\.prize-density-compact\s+\.prize-card/);
  assert.match(winnersShowcase, /overflow:\s*hidden/);
  assert.match(winnerTicker, /overflow-y:\s*auto/);
  assert.match(css, /\.showcase-panel\.showing-winners\s+\.prize-showcase/);
  assert.match(css, /\.showcase-panel\.showing-winners\s+\.winners-showcase/);
});

test("hidden panels stay hidden even when component classes define display", () => {
  const hidden = block("[hidden]");

  assert.match(hidden, /display:\s*none\s*!important/);
});

test("winner list supports manual vertical scrolling for many results", () => {
  const scrollingTicker = block(".winner-ticker.scrolling");
  const compactTicker = block(".winner-ticker.compact-grid");
  const compactTrack = block(".winner-ticker.compact-grid .winner-track");
  const compactRow = block(".winner-ticker.compact-grid .winner-row");
  const winnerTrack = block(".winner-track");
  const scrollingTrack = block(".winner-ticker.scrolling .winner-track");
  const scrollingRow = block(".winner-ticker.scrolling .winner-row");

  assert.doesNotMatch(css, /@keyframes\s+winner-scroll/);
  assert.match(compactTicker, /overflow:\s*hidden/);
  assert.match(compactTrack, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(compactTrack, /height:\s*100%/);
  assert.match(compactRow, /min-height:\s*0/);
  assert.doesNotMatch(scrollingTicker, /animation:\s*winner-scroll|transform|will-change:\s*transform/);
  assert.match(scrollingTicker, /overflow-y:\s*auto/);
  assert.match(scrollingTicker, /overscroll-behavior:\s*contain/);
  assert.match(winnerTrack, /display:\s*grid/);
  assert.match(scrollingTrack, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(scrollingTrack, /animation:\s*winner-scroll|transform|will-change:\s*transform/);
  assert.match(scrollingRow, /min-height:\s*0/);
  assert.match(block(".winner-employee-id"), /color:\s*var\(--ink\)/);
  assert.match(block(".winner-ticker.compact-grid .winner-employee-id"), /color:\s*var\(--ink\)/);
});

test("visual language is deep blue, restrained, and not the old nine-grid board", () => {
  const body = block("body");

  assert.match(body, /background:/);
  assert.match(css, /--ink:\s*#f7fbff/);
  assert.match(css, /--accent:\s*#9fd7ff/);
  assert.doesNotMatch(css, /\.prize-board|\.start-button/);
});

test("layout defines responsive ratio breakpoints for wide, narrow, and short screens", () => {
  assert.match(css, /@media\s*\(max-aspect-ratio:\s*4\/3\)/);
  assert.match(css, /@media\s*\(min-aspect-ratio:\s*18\/9\)/);
  assert.match(css, /@media\s*\(max-height:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*920px\)/);
  assert.match(css, /@media\s*\(max-height:\s*760px\)[\s\S]*\.prize-showcase\.prize-density-spacious\.prize-count-1\s*\{[\s\S]*grid-auto-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media\s*\(max-height:\s*760px\)[\s\S]*\.prize-showcase\.prize-count-1\s+\.prize-card-hero\s*\{[\s\S]*min-height:\s*clamp\(220px,\s*42vh,\s*320px\)/);
  assert.match(css, /@media\s*\(max-height:\s*760px\)[\s\S]*\.prize-showcase\.prize-count-1\s+\.prize-card h3\s*\{[\s\S]*font-size:\s*clamp\(38px,\s*5\.4vh,\s*48px\)/);
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

test("toast remains a top-center overlay above dialogs", () => {
  const toast = block(".toast");
  const visibleToast = block(".toast.visible");

  assert.match(toast, /top:\s*72px/);
  assert.match(toast, /left:\s*50%/);
  assert.match(toast, /z-index:\s*9999/);
  assert.match(toast, /text-align:\s*center/);
  assert.match(visibleToast, /transform:\s*translate\(-50%,\s*0\)/);
});
