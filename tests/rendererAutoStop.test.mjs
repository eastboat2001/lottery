import assert from "node:assert/strict";

function createElement() {
  const listeners = {};
  const classes = new Set();
  const element = {
    dataset: {},
    disabled: false,
    innerHTML: "",
    listeners,
    open: false,
    files: [],
    hidden: false,
    isConnected: true,
    parentElement: null,
    src: "",
    textContent: "",
    value: "",
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    classList: {
      add(...names) {
        for (const name of names) {
          classes.add(name);
        }
      },
      remove(...names) {
        for (const name of names) {
          classes.delete(name);
        }
      },
      toggle(name, force) {
        if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
      contains(name) {
        return classes.has(name);
      },
    },
    close() {
      element.open = false;
    },
    click() {
      listeners.click?.({ target: element, preventDefault() {} });
    },
    append(...children) {
      for (const child of children) {
        child.parentElement = element;
      }
    },
    focus() {
      globalThis.document.activeElement = element;
    },
    showModal() {
      element.open = true;
    },
  };
  return element;
}

function createRendererHarness(options = {}) {
  const ids = [
    "activityTitle",
    "footerActivityTitle",
    "activityTitleInput",
    "adminLoginDialog",
    "adminPasswordInput",
    "loginSubmitButton",
    "clockText",
    "drawStatusText",
    "dataStatus",
    "importButton",
    "exportButton",
    "refreshButton",
    "adminButton",
    "startButton",
    "showcasePanel",
    "showcaseTitle",
    "showcaseMeta",
    "prizeShowcase",
    "winnersShowcase",
    "winnerTicker",
    "drawAnimation",
    "employeeCount",
    "prizeCount",
    "winnerCount",
    "participantCount",
    "adminDialog",
    "workbookPathText",
    "saveTitleButton",
    "resetButton",
    "adminTableWrap",
    "rosterFileInput",
    "prizeImageInput",
    "toast",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, createElement()]));
  const tabButtons = ["employees", "prizes", "records"].map((tab) => {
    const button = createElement();
    button.dataset.tab = tab;
    return button;
  });
  const timeouts = new Map();
  const intervals = new Map();
  const windowListeners = {};
  let nextTimerId = 1;
  let saveCalls = 0;
  let snapshot = {
    workbookPath: "浏览器本地存储",
    configPath: "浏览器本地存储",
    adminPassword: "123456",
    activityTitle: options.activityTitle || "年度活动抽奖",
    participants: options.participants || [
      { employeeId: "1000001", name: "王晨" },
      { employeeId: "1000002", name: "李佳" },
    ],
    prizes: options.prizes || [
      { name: "蓝牙耳机", remainingQty: 1, imageUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" },
      { name: "保温杯", remainingQty: 1, imageUrl: "" },
    ],
    records: options.records || [],
  };

  globalThis.document = {
    activeElement: null,
    body: createElement(),
    title: "",
    querySelector(selector) {
      return selector.startsWith("#") ? elements[selector.slice(1)] : null;
    },
    querySelectorAll(selector) {
      if (selector === ".tab-button") {
        return tabButtons;
      }
      return [];
    },
  };

  globalThis.localStorage = {
    getItem(key) {
      return key === "activity-lottery-batch-state-v1" ? JSON.stringify(snapshot) : null;
    },
    setItem(key, value) {
      if (key !== "activity-lottery-batch-state-v1") {
        return;
      }
      saveCalls += 1;
      snapshot = JSON.parse(value);
    },
    removeItem() {},
  };

  globalThis.window = {
    confirm: () => true,
    LOTTERY_CONFIG: {
      adminPassword: "123456",
      defaultActivityTitle: options.activityTitle || "年度活动抽奖",
    },
    addEventListener(type, handler) {
      windowListeners[type] = handler;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
    setInterval(callback, ms) {
      const id = nextTimerId;
      nextTimerId += 1;
      intervals.set(id, { callback, ms, name: callback.name });
      return id;
    },
    setTimeout(callback, ms) {
      const id = nextTimerId;
      nextTimerId += 1;
      timeouts.set(id, {
        callback: async () => {
          timeouts.delete(id);
          return callback();
        },
        ms,
        name: callback.name,
      });
      return id;
    },
  };

  return {
    elements,
    intervals,
    tabButtons,
    timeouts,
    windowListeners,
    getSaveCalls() {
      return saveCalls;
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  } finally {
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.window;
  }
}

await test("batch draw plays animation before saving and showing winners", async () => {
  const harness = createRendererHarness();
  await import(`../app/renderer.js?batchAnimationTest=${Date.now()}`);
  await flushPromises();

  assert.match(harness.elements.prizeShowcase.innerHTML, /蓝牙耳机/);
  assert.equal(harness.elements.winnersShowcase.hidden, true);

  harness.elements.startButton.listeners.click();
  await flushPromises();

  assert.equal(harness.getSaveCalls(), 0);
  assert.equal(harness.elements.startButton.disabled, true);
  assert.equal(harness.elements.drawAnimation.hidden, false);
  assert.equal(harness.elements.showcaseTitle.textContent, "抽奖中");

  const finishTimer = [...harness.timeouts.values()].find((timer) => timer.name === "finalizeBatchDraw");
  assert.ok(finishTimer, "expected batch draw to wait for an animation timer");
  assert.ok(finishTimer.ms >= 1200, "animation should be visible before results are committed");

  await finishTimer.callback();
  await flushPromises();

  assert.equal(harness.getSaveCalls(), 1);
  assert.equal(harness.getSnapshot().records.length, 2);
  assert.equal(harness.elements.drawAnimation.hidden, true);
  assert.equal(harness.elements.winnersShowcase.hidden, false);
  assert.equal(harness.elements.prizeShowcase.hidden, true);
  assert.match(harness.elements.winnerTicker.innerHTML, /王晨/);
  assert.match(harness.elements.winnerTicker.innerHTML, /1000001/);
  assert.match(harness.elements.winnerTicker.innerHTML, /蓝牙耳机|保温杯/);
});

await test("existing winner records render 36 winners in a compact non-scrolling grid", async () => {
  const records = Array.from({ length: 36 }, (_, index) => ({
    employeeId: String(1000000 + index),
    name: `中奖者${index + 1}`,
    prizeName: "全勤参与奖",
    time: "2026-09-01 10:25:31",
  }));
  const harness = createRendererHarness({
    prizes: [{ name: "全勤参与奖", description: "50元小卖部卡", remainingQty: 36 }],
    records,
  });
  await import(`../app/renderer.js?compactWinnerGridTest=${Date.now()}`);
  await flushPromises();

  assert.equal(harness.elements.showcaseTitle.textContent, "中奖名单");
  assert.equal(harness.elements.winnersShowcase.hidden, false);
  assert.equal(harness.elements.winnerTicker.classList.contains("compact-grid"), true);
  assert.equal(harness.elements.winnerTicker.classList.contains("scrolling"), false);
  assert.match(harness.elements.winnerTicker.innerHTML, /class="winner-track"/);
  assert.match(harness.elements.winnerTicker.innerHTML, /class="winner-employee-id"/);
  assert.match(harness.elements.winnerTicker.innerHTML, /中奖者36/);
  assert.match(harness.elements.winnerTicker.innerHTML, /1000035/);
});

await test("winner records still enable scrolling when they exceed the one-screen grid limit", async () => {
  const records = Array.from({ length: 48 }, (_, index) => ({
    employeeId: String(1000000 + index),
    name: `中奖者${index + 1}`,
    prizeName: "全勤参与奖",
    time: "2026-09-01 10:25:31",
  }));
  const harness = createRendererHarness({ records });
  harness.elements.winnerTicker.clientHeight = 300;
  harness.elements.winnerTicker.scrollHeight = 900;
  await import(`../app/renderer.js?scrollingWinnerTest=${Date.now()}`);
  await flushPromises();

  assert.equal(harness.elements.winnerTicker.classList.contains("compact-grid"), false);
  assert.equal(harness.elements.winnerTicker.classList.contains("scrolling"), true);
  assert.match(harness.elements.winnerTicker.innerHTML, /class="winner-track"/);
  assert.match(harness.elements.winnerTicker.innerHTML, /中奖者48/);
  assert.equal([...harness.intervals.values()].some((timer) => timer.name === "advanceWinnerAutoScroll"), false);
  assert.equal([...harness.timeouts.values()].some((timer) => timer.name === "resumeWinnerAutoScroll"), false);
  assert.equal(harness.elements.winnerTicker.listeners.wheel, undefined);
});

await test("batch draw refuses to run without participants or available prizes", async () => {
  const harness = createRendererHarness({ participants: [], prizes: [{ name: "蓝牙耳机", remainingQty: 1 }] });
  await import(`../app/renderer.js?emptyBatchTest=${Date.now()}`);
  await flushPromises();

  harness.elements.startButton.listeners.click();
  await flushPromises();

  assert.equal(harness.getSaveCalls(), 0);
  assert.equal(harness.elements.drawStatusText.textContent, "请导入名单");
  assert.equal(harness.elements.startButton.disabled, false);
});

await test("admin dialogs keep focus within the visible admin surface", async () => {
  const harness = createRendererHarness();
  await import(`../app/renderer.js?adminFocusTest=${Date.now()}`);
  await flushPromises();

  harness.elements.adminDialog.showModal();
  harness.elements.activityTitleInput.focus();
  harness.elements.refreshButton.listeners.click();
  await flushPromises();

  assert.equal(globalThis.document.activeElement, harness.elements.activityTitleInput);

  harness.elements.adminDialog.close();
  harness.elements.adminLoginDialog.showModal();
  harness.elements.adminPasswordInput.focus();
  harness.elements.refreshButton.listeners.click();
  await flushPromises();

  assert.equal(globalThis.document.activeElement, harness.elements.adminPasswordInput);
});

await test("admin password is required every time the admin page is opened", async () => {
  const harness = createRendererHarness();
  await import(`../app/renderer.js?adminLoginEveryTimeTest=${Date.now()}`);
  await flushPromises();

  harness.elements.adminButton.listeners.click();
  assert.equal(harness.elements.adminLoginDialog.open, true);
  assert.equal(harness.elements.adminDialog.open, false);

  harness.elements.adminPasswordInput.value = "123456";
  harness.elements.loginSubmitButton.listeners.click();
  await flushPromises();

  assert.equal(harness.elements.adminLoginDialog.open, false);
  assert.equal(harness.elements.adminDialog.open, true);

  harness.elements.adminDialog.close();
  harness.elements.adminButton.listeners.click();

  assert.equal(harness.elements.adminLoginDialog.open, true);
  assert.equal(harness.elements.adminDialog.open, false);
  assert.equal(harness.elements.adminPasswordInput.value, "");
});

await test("admin title setting persists and updates the visible title", async () => {
  const harness = createRendererHarness({
    activityTitle: "年度活动抽奖",
  });
  await import(`../app/renderer.js?titleSettingTest=${Date.now()}`);
  await flushPromises();

  assert.equal(harness.elements.activityTitle.textContent, "年度活动抽奖");
  assert.equal(harness.elements.footerActivityTitle.textContent, "活动名称：年度活动抽奖");

  harness.elements.activityTitleInput.value = "2026 年度幸运抽奖";
  harness.elements.saveTitleButton.listeners.click();
  await flushPromises();

  assert.equal(harness.elements.activityTitle.textContent, "2026 年度幸运抽奖");
  assert.equal(harness.elements.footerActivityTitle.textContent, "活动名称：2026 年度幸运抽奖");
});
