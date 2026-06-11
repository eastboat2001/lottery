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
    "employeeInput",
    "hintText",
    "dataStatus",
    "importButton",
    "exportButton",
    "refreshButton",
    "adminButton",
    "startButton",
    "resultImage",
    "resultTitle",
    "resultText",
    "resultPrize",
    "recordsBody",
    "employeeCount",
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
  const prizeCards = Array.from({ length: 8 }, createElement);
  const timeouts = new Map();
  const intervals = new Map();
  const windowListeners = {};
  let nextTimerId = 1;
  let saveCalls = 0;
  let snapshot = {
    workbookPath: "浏览器本地存储",
    configPath: "浏览器本地存储",
    adminPassword: "123456",
    activityTitle: options.activityTitle || "2026年9月 EHS活动 抽奖",
    employeeIds: ["1234567"],
    prizes: options.prizes || [{ name: "小风扇", remainingQty: 1, imageUrl: "../assets/prizes/fan.png" }],
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
      if (selector === ".prize-card") {
        return prizeCards;
      }
      if (selector === ".tab-button") {
        return [];
      }
      return [];
    },
  };

  globalThis.localStorage = {
    getItem(key) {
      return key === "ehs-lottery-static-state-v1" ? JSON.stringify(snapshot) : null;
    },
    setItem(key, value) {
      if (key !== "ehs-lottery-static-state-v1") {
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
      defaultActivityTitle: options.activityTitle || "2026年9月 EHS活动 抽奖",
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
      intervals.set(id, { callback, ms });
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
    prizeCards,
    timeouts,
    windowListeners,
    getSaveCalls() {
      return saveCalls;
    },
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function activePrizeCardIndex(prizeCards) {
  return prizeCards.findIndex((card) => card.classList.contains("active"));
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

await test("draw runs quickly and stops immediately after a second click", async () => {
  const harness = createRendererHarness();
  await import(`../app/renderer.js?autoStopTest=${Date.now()}`);
  await flushPromises();

  harness.elements.employeeInput.value = "1234567";
  harness.elements.startButton.listeners.click();
  await flushPromises();

  assert.equal(harness.getSaveCalls(), 0);
  assert.equal(harness.elements.startButton.innerHTML, "停止<br />抽奖");
  assert.equal([...harness.timeouts.values()].some((timer) => timer.name === "stopDraw"), false);
  assert.ok(
    [...harness.timeouts.values()].some((timer) => timer.name === "runHighlightFrame" && timer.ms <= 36),
    "expected the running highlight animation to use a fast interval",
  );

  harness.elements.startButton.listeners.click();
  await flushPromises();

  assert.equal(harness.getSaveCalls(), 1);
  assert.equal(harness.elements.startButton.innerHTML, "开始<br />抽奖");
  assert.equal([...harness.timeouts.values()].some((entry) => entry.name === "runHighlightFrame"), false);
});

await test("spacebar stops a running draw immediately", async () => {
  const harness = createRendererHarness();
  await import(`../app/renderer.js?spaceStopTest=${Date.now()}`);
  await flushPromises();

  harness.elements.employeeInput.value = "1234567";
  harness.elements.startButton.listeners.click();
  await flushPromises();

  let defaultPrevented = false;
  harness.windowListeners.keydown({
    key: " ",
    preventDefault() {
      defaultPrevented = true;
    },
  });
  await flushPromises();

  assert.equal(defaultPrevented, true);
  assert.equal(harness.getSaveCalls(), 1);
  assert.equal(harness.elements.startButton.innerHTML, "开始<br />抽奖");
});

await test("draw keeps clockwise order while running and stops without deceleration", async () => {
  const prizes = Array.from({ length: 8 }, (_, index) => ({
    name: `奖品${index + 1}`,
    remainingQty: 1,
    imageUrl: "",
  }));
  const clockwiseOrder = [0, 1, 2, 4, 7, 6, 5, 3];
  const harness = createRendererHarness({ prizes });
  await import(`../app/renderer.js?clockwiseStopTest=${Date.now()}`);
  await flushPromises();

  harness.elements.employeeInput.value = "1234567";
  harness.elements.startButton.listeners.click();
  await flushPromises();

  const runningSequence = [activePrizeCardIndex(harness.prizeCards)];
  for (let index = 0; index < 5; index += 1) {
    const timer = [...harness.timeouts.values()].find((entry) => entry.name === "runHighlightFrame");
    assert.ok(timer, "expected running draw to keep scheduling highlight frames");
    await timer.callback();
    await flushPromises();
    runningSequence.push(activePrizeCardIndex(harness.prizeCards));
  }
  assert.deepEqual(runningSequence, clockwiseOrder.slice(0, runningSequence.length));

  const beforeStopIndex = activePrizeCardIndex(harness.prizeCards);
  harness.elements.startButton.listeners.click();
  await flushPromises();

  const expectedStart = clockwiseOrder.indexOf(beforeStopIndex);

  assert.ok(expectedStart >= 0);
  assert.equal(harness.getSaveCalls(), 1);
  assert.equal([...harness.timeouts.values()].some((entry) => entry.name === "runHighlightFrame"), false);
});

await test("draw highlight skips unconfigured prize slots", async () => {
  const prizes = Array.from({ length: 7 }, (_, index) => ({
    name: `奖品${index + 1}`,
    remainingQty: 1,
    imageUrl: "",
  }));
  const harness = createRendererHarness({ prizes });
  await import(`../app/renderer.js?emptyHighlightTest=${Date.now()}`);
  await flushPromises();

  harness.elements.employeeInput.value = "1234567";
  harness.elements.startButton.listeners.click();
  await flushPromises();

  for (let index = 0; index < 12; index += 1) {
    const highlightTimer = [...harness.timeouts.values()].find((timer) => timer.name === "runHighlightFrame");
    assert.ok(highlightTimer, "expected startDraw to schedule highlight frames");
    await highlightTimer.callback();
    assert.equal(harness.prizeCards[7].classList.contains("active"), false);
  }
});

await test("main prize cards hide stock counts and show sold-out placeholders", async () => {
  const harness = createRendererHarness({
    prizes: [
      { name: "小风扇", remainingQty: 0, imageUrl: "../assets/prizes/fan.png" },
      { name: "天堂伞", remainingQty: 2, imageUrl: "" },
    ],
  });
  await import(`../app/renderer.js?soldOutPrizeCardTest=${Date.now()}`);
  await flushPromises();

  assert.match(harness.prizeCards[0].innerHTML, /已抽完/);
  assert.doesNotMatch(harness.prizeCards[0].innerHTML, /剩余/);
  assert.match(harness.prizeCards[1].innerHTML, /天堂伞/);
  assert.doesNotMatch(harness.prizeCards[1].innerHTML, /剩余：2/);
});

await test("notice result states hide the prize image and do not keep the winning title", async () => {
  const harness = createRendererHarness({
    records: [{ employeeId: "1234567", prizeName: "小风扇", time: "2026-06-09 09:30:00" }],
  });
  await import(`../app/renderer.js?noticeResultStateTest=${Date.now()}`);
  await flushPromises();

  harness.elements.employeeInput.value = "1234567";
  harness.elements.startButton.listeners.click();
  await flushPromises();

  assert.equal(harness.elements.resultTitle.textContent, "提示信息");
  assert.equal(harness.elements.resultText.textContent, "提示");
  assert.equal(harness.elements.resultPrize.textContent, "您已参与过抽奖，不能重复参加");
  assert.equal(harness.elements.resultImage.hidden, true);
});

await test("ineligible draw attempts are not saved or shown as winning records", async () => {
  const harness = createRendererHarness({
    records: [
      { employeeId: "9100000", prizeName: "无抽奖资格", time: "2026-06-09 09:34:37" },
      { employeeId: "9100007", prizeName: "10元小卖部购物券", time: "2026-06-09 09:34:09" },
    ],
  });
  await import(`../app/renderer.js?ineligibleRecordsTest=${Date.now()}`);
  await flushPromises();

  assert.doesNotMatch(harness.elements.recordsBody.innerHTML, /无抽奖资格/);
  assert.match(harness.elements.recordsBody.innerHTML, /10元小卖部购物券/);

  harness.elements.employeeInput.value = "9999999";
  harness.elements.startButton.listeners.click();
  await flushPromises();

  assert.equal(harness.getSaveCalls(), 0);
  assert.equal(harness.elements.resultPrize.textContent, "您未按时完成答题，无法参与抽奖");
  assert.doesNotMatch(harness.elements.recordsBody.innerHTML, /9999999/);
});

await test("toast remains visible for three seconds", async () => {
  const harness = createRendererHarness();
  await import(`../app/renderer.js?toastDurationTest=${Date.now()}`);
  await flushPromises();

  harness.elements.adminButton.listeners.click();
  harness.elements.adminPasswordInput.value = "wrong";
  harness.elements.loginSubmitButton.listeners.click();
  await flushPromises();

  assert.equal(
    [...harness.timeouts.values()].some((timer) => timer.ms === 3000),
    true,
  );
});

await test("admin dialogs keep focus from being stolen by main employee input resets", async () => {
  const harness = createRendererHarness();
  await import(`../app/renderer.js?adminFocusTest=${Date.now()}`);
  await flushPromises();

  harness.elements.adminDialog.showModal();
  harness.elements.activityTitleInput.focus();
  harness.elements.refreshButton.listeners.click();
  await flushPromises();

  assert.notEqual(globalThis.document.activeElement, harness.elements.employeeInput);

  harness.elements.adminDialog.close();
  harness.elements.adminLoginDialog.showModal();
  harness.elements.adminPasswordInput.focus();
  harness.elements.refreshButton.listeners.click();
  await flushPromises();

  assert.notEqual(globalThis.document.activeElement, harness.elements.employeeInput);
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

await test("toast is attached to the visible admin surface instead of staying behind the modal backdrop", async () => {
  const harness = createRendererHarness();
  await import(`../app/renderer.js?adminToastHostTest=${Date.now()}`);
  await flushPromises();

  harness.elements.adminButton.listeners.click();
  harness.elements.adminPasswordInput.value = "wrong";
  harness.elements.loginSubmitButton.listeners.click();
  await flushPromises();

  assert.equal(harness.elements.toast.parentElement, harness.elements.adminLoginDialog);
  assert.equal(harness.elements.toast.classList.contains("visible"), true);

  harness.elements.adminPasswordInput.value = "123456";
  harness.elements.loginSubmitButton.listeners.click();
  await flushPromises();

  harness.elements.activityTitleInput.value = "2026年9月 管理员弹窗提示测试";
  harness.elements.saveTitleButton.listeners.click();
  await flushPromises();

  assert.equal(harness.elements.toast.parentElement, harness.elements.adminDialog);
  assert.equal(harness.elements.toast.textContent, "活动标题已保存");
});

await test("admin title setting persists and updates the visible title", async () => {
  const harness = createRendererHarness({
    activityTitle: "2026年9月 安全月活动抽奖",
  });
  await import(`../app/renderer.js?titleSettingTest=${Date.now()}`);
  await flushPromises();

  assert.equal(harness.elements.activityTitle.textContent, "2026年9月 安全月活动抽奖");
  assert.equal(harness.elements.footerActivityTitle.textContent, "活动名称：2026年9月 安全月活动抽奖");

  harness.elements.activityTitleInput.value = "2026年10月 EHS知识竞赛抽奖";
  harness.elements.saveTitleButton.listeners.click();
  await flushPromises();

  assert.equal(harness.elements.activityTitle.textContent, "2026年10月 EHS知识竞赛抽奖");
  assert.equal(harness.elements.footerActivityTitle.textContent, "活动名称：2026年10月 EHS知识竞赛抽奖");
});
