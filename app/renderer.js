const NO_QUALIFICATION_PRIZE = "无抽奖资格";
const RUNNING_SPIN_INTERVALS_MS = [24, 29, 34, 26, 32];
const CLOCKWISE_PRIZE_CARD_INDEXES = [0, 1, 2, 4, 7, 6, 5, 3];

function normalizeEmployeeId(rawInput) {
  const compact = String(rawInput ?? "").trim().replace(/[\s\r\n\t]+/g, "");
  if (!compact) {
    throw new Error("请输入或扫描工号");
  }
  if (compact.length < 7) {
    throw new Error("请输入正确的工号");
  }

  const employeeId = compact.slice(0, 7);
  if (!/^\d{7}$/.test(employeeId)) {
    throw new Error("请输入正确的工号");
  }
  return employeeId;
}

function hasEffectiveWinningRecord(employeeId, records) {
  return records.some(
    (record) => record.employeeId === employeeId && record.prizeName !== NO_QUALIFICATION_PRIZE,
  );
}

function selectWeightedPrize(prizes, random = Math.random) {
  const availablePrizes = prizes.filter((prize) => Number(prize.remainingQty) > 0);
  if (availablePrizes.length === 0) {
    throw new Error("奖品已抽完");
  }

  const totalWeight = availablePrizes.reduce((sum, prize) => sum + Number(prize.remainingQty), 0);
  const ticket = Math.floor(random() * totalWeight) + 1;
  let cumulative = 0;

  for (const prize of availablePrizes) {
    cumulative += Number(prize.remainingQty);
    if (ticket <= cumulative) {
      return prize;
    }
  }

  return availablePrizes.at(-1);
}

function formatNow(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
  ].join("");
}

const STORAGE_KEY = "ehs-lottery-static-state-v1";
const DEFAULT_ADMIN_PASSWORD = "123456";
const DEFAULT_ACTIVITY_TITLE = "活动抽奖";
const LOCAL_CONFIG_LABEL = "浏览器本地存储";
const MAX_PRIZE_COUNT = 8;

const DEFAULT_PRIZES = [
  { name: "小风扇", remainingQty: 30, imagePath: "fan.png", imageUrl: "../assets/prizes/fan.png" },
  { name: "指甲刀套装", remainingQty: 30, imagePath: "nail_kit.png", imageUrl: "../assets/prizes/nail_kit.png" },
  { name: "天堂伞", remainingQty: 30, imagePath: "umbrella.png", imageUrl: "../assets/prizes/umbrella.png" },
  { name: "护手霜", remainingQty: 30, imagePath: "hand_cream.png", imageUrl: "../assets/prizes/hand_cream.png" },
  { name: "冰袖", remainingQty: 30, imagePath: "sleeves.png", imageUrl: "../assets/prizes/sleeves.png" },
  { name: "休闲书包", remainingQty: 30, imagePath: "backpack.png", imageUrl: "../assets/prizes/backpack.png" },
  { name: "软抽纸面巾", remainingQty: 30, imagePath: "tissue.png", imageUrl: "../assets/prizes/tissue.png" },
  { name: "10元小卖部购物券", remainingQty: 4600, imagePath: "coupon.png", imageUrl: "../assets/prizes/coupon.png" },
];

function createDefaultSnapshot(overrides = {}) {
  return normalizeSnapshot({
    workbookPath: LOCAL_CONFIG_LABEL,
    configPath: LOCAL_CONFIG_LABEL,
    adminPassword: DEFAULT_ADMIN_PASSWORD,
    activityTitle: DEFAULT_ACTIVITY_TITLE,
    employeeIds: [],
    prizes: DEFAULT_PRIZES,
    records: [],
    ...overrides,
  });
}

function normalizeSnapshot(snapshot = {}) {
  const employeeIds = uniqueValues(
    ensureArray(snapshot.employeeIds)
      .map((employeeId) => normalizeImportedEmployeeId(employeeId))
      .filter(Boolean),
  );

  return {
    workbookPath: LOCAL_CONFIG_LABEL,
    configPath: LOCAL_CONFIG_LABEL,
    adminPassword: normalizeAdminPassword(snapshot.adminPassword),
    activityTitle: normalizeActivityTitleValue(snapshot.activityTitle),
    employeeIds,
    prizes: normalizePrizes(snapshot.prizes),
    records: normalizeRecords(snapshot.records),
  };
}

function normalizePrizes(prizes) {
  const seen = new Set();

  return ensureArray(prizes)
    .map((prize) => ({
      name: String(prize?.name ?? "").trim(),
      remainingQty: Math.max(0, Math.trunc(Number(prize?.remainingQty) || 0)),
      imagePath: String(prize?.imagePath ?? "").trim(),
      imageUrl: String(prize?.imageUrl ?? "").trim(),
    }))
    .filter((prize) => prize.name)
    .filter((prize) => {
      if (seen.has(prize.name)) {
        return false;
      }
      seen.add(prize.name);
      return true;
    })
    .slice(0, MAX_PRIZE_COUNT);
}

function employeeIdsFromWorkbook(workbook, XLSX) {
  if (!workbook?.SheetNames?.length) {
    throw new Error("抽奖名单文件中没有可读取的工作表");
  }

  const sheetName = workbook.Sheets["抽奖名单"] ? "抽奖名单" : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const header = rows[0] || [];
  const employeeColumnIndex = header.findIndex((cell) => String(cell ?? "").trim() === "工号");

  if (employeeColumnIndex < 0) {
    throw new Error("导入名单必须包含“工号”列");
  }

  const employeeIds = rows
    .slice(1)
    .map((row) => normalizeImportedEmployeeId(row[employeeColumnIndex]))
    .filter(Boolean);

  const uniqueEmployeeIds = uniqueValues(employeeIds);
  if (uniqueEmployeeIds.length === 0) {
    throw new Error("导入名单中没有可用的7位工号");
  }

  return uniqueEmployeeIds;
}

function winningRows(records) {
  return [
    ["工号", "奖品", "时间"],
    ...normalizeRecords(records).map((record) => [record.employeeId, record.prizeName, record.time]),
  ];
}

function normalizeActivityTitleValue(value) {
  const title = String(value ?? "").trim();
  return title || DEFAULT_ACTIVITY_TITLE;
}

function normalizeAdminPassword(value) {
  const password = String(value ?? "").trim();
  return password || DEFAULT_ADMIN_PASSWORD;
}

function normalizeRecords(records) {
  return ensureArray(records)
    .map((record) => ({
      employeeId: normalizeImportedEmployeeId(record?.employeeId),
      prizeName: String(record?.prizeName ?? "").trim(),
      time: String(record?.time ?? "").trim(),
    }))
    .filter((record) => record.employeeId && record.prizeName && record.prizeName !== NO_QUALIFICATION_PRIZE);
}

function normalizeImportedEmployeeId(value) {
  const text = String(value ?? "").trim().replace(/[\s\r\n\t]+/g, "");
  const employeeId = text.slice(0, 7);
  return /^\d{7}$/.test(employeeId) ? employeeId : "";
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueValues(values) {
  return [...new Set(values)];
}

const elements = {
  activityTitle: document.querySelector("#activityTitle"),
  footerActivityTitle: document.querySelector("#footerActivityTitle"),
  activityTitleInput: document.querySelector("#activityTitleInput"),
  adminLoginDialog: document.querySelector("#adminLoginDialog"),
  adminPasswordInput: document.querySelector("#adminPasswordInput"),
  loginSubmitButton: document.querySelector("#loginSubmitButton"),
  clockText: document.querySelector("#clockText"),
  employeeInput: document.querySelector("#employeeInput"),
  hintText: document.querySelector("#hintText"),
  dataStatus: document.querySelector("#dataStatus"),
  importButton: document.querySelector("#importButton"),
  exportButton: document.querySelector("#exportButton"),
  refreshButton: document.querySelector("#refreshButton"),
  adminButton: document.querySelector("#adminButton"),
  startButton: document.querySelector("#startButton"),
  prizeCards: [...document.querySelectorAll(".prize-card")],
  resultImage: document.querySelector("#resultImage"),
  resultTitle: document.querySelector("#resultTitle"),
  resultText: document.querySelector("#resultText"),
  resultPrize: document.querySelector("#resultPrize"),
  recordsBody: document.querySelector("#recordsBody"),
  employeeCount: document.querySelector("#employeeCount"),
  participantCount: document.querySelector("#participantCount"),
  adminDialog: document.querySelector("#adminDialog"),
  workbookPathText: document.querySelector("#workbookPathText"),
  saveTitleButton: document.querySelector("#saveTitleButton"),
  resetButton: document.querySelector("#resetButton"),
  adminTableWrap: document.querySelector("#adminTableWrap"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  rosterFileInput: document.querySelector("#rosterFileInput"),
  prizeImageInput: document.querySelector("#prizeImageInput"),
  toast: document.querySelector("#toast"),
};

const state = {
  snapshot: createConfiguredDefaultSnapshot(),
  prizeDrafts: [],
  pendingPrizeImageIndex: -1,
  activeEmployeeId: "",
  activeIndex: -1,
  scanTimer: 0,
  animationTimer: 0,
  spinDelayIndex: 0,
  stopTargetIndex: -1,
  pendingPrizeName: "",
  running: false,
  slowing: false,
  adminTab: "employees",
};

bindEvents();
applyActivityTitle(configuredDefaultActivityTitle());
startClock();
loadData({ silent: true });

function bindEvents() {
  elements.importButton.addEventListener("click", openWorkbook);
  elements.exportButton.addEventListener("click", exportRecords);
  elements.refreshButton.addEventListener("click", () => loadData());
  elements.rosterFileInput.addEventListener("change", handleRosterFileChange);
  elements.prizeImageInput.addEventListener("change", handlePrizeImageFileChange);
  elements.adminButton.addEventListener("click", openAdminLogin);
  elements.loginSubmitButton.addEventListener("click", verifyAdminLogin);
  elements.adminPasswordInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    verifyAdminLogin();
  });
  elements.saveTitleButton.addEventListener("click", saveActivityTitle);
  elements.resetButton.addEventListener("click", resetAllData);
  elements.adminTableWrap.addEventListener("pointerdown", handleAdminEditablePointer);
  elements.adminTableWrap.addEventListener("input", handleAdminTableInput);
  elements.adminTableWrap.addEventListener("click", handleAdminTableClick);
  elements.startButton.addEventListener("click", () => {
    if (state.running) {
      requestStopDraw();
      return;
    }
    startDraw();
  });

  elements.employeeInput.addEventListener("input", () => {
    if (state.running) {
      return;
    }
    clearTimeout(state.scanTimer);
    const compact = elements.employeeInput.value.replace(/\s+/g, "");
    if (compact.length >= 9) {
      state.scanTimer = window.setTimeout(startDraw, 180);
    }
  });

  elements.employeeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (state.running) {
      return;
    }
    startDraw();
  });

  window.addEventListener("keydown", (event) => {
    if (!state.running) {
      return;
    }
    if (event.key === " " && !isAdminSurfaceOpen()) {
      event.preventDefault();
      requestStopDraw();
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
  });

  for (const button of elements.tabButtons) {
    button.addEventListener("click", () => {
      state.adminTab = button.dataset.tab;
      renderAdminDialog();
    });
  }
}

function loadData(options = {}) {
  try {
    const snapshot = readSnapshotFromStorage();
    applySnapshot(snapshot);
    setResult("等待抽奖", "请扫描工牌或输入工号", "../assets/prizes/gift.png");
    if (!options.silent) {
      showToast("数据已刷新");
    }
  } catch (error) {
    showToast(error.message || String(error));
  } finally {
    resetInput();
  }
}

function openWorkbook() {
  elements.rosterFileInput.value = "";
  elements.rosterFileInput.click();
}

async function handleRosterFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const XLSX = ensureXlsx();
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const employeeIds = employeeIdsFromWorkbook(workbook, XLSX);
    const snapshot = saveSnapshot({ ...state.snapshot, employeeIds });
    applySnapshot(snapshot);
    setResult("等待抽奖", "请扫描工牌或输入工号", "../assets/prizes/gift.png");
    showToast(`抽奖名单已导入：${employeeIds.length} 人`);
  } catch (error) {
    showToast(error.message || String(error));
  } finally {
    event.target.value = "";
    resetInput();
  }
}

function resetAllData() {
  if (!window.confirm("确认重置抽奖名单、中奖记录和奖品设置？管理员密码和活动标题会保留。")) {
    return;
  }

  try {
    const snapshot = saveSnapshot(
      createDefaultSnapshot({
        adminPassword: configuredAdminPassword(),
        activityTitle: state.snapshot.activityTitle,
      }),
    );
    applySnapshot(snapshot);
    setResult("等待抽奖", "请扫描工牌或输入工号", "../assets/prizes/gift.png");
    showToast("数据已重置");
  } catch (error) {
    showToast(error.message || String(error));
  } finally {
    resetInput();
  }
}

function exportRecords() {
  try {
    const XLSX = ensureXlsx();
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(winningRows(state.snapshot.records));
    XLSX.utils.book_append_sheet(workbook, worksheet, "中奖信息");
    const content = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([content], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `中奖信息_${formatNow().replaceAll(":", "").replaceAll(" ", "_")}.xlsx`,
    );
    showToast("中奖信息已导出");
  } catch (error) {
    showToast(error.message || String(error));
  }
}

async function startDraw() {
  if (state.running) {
    return;
  }

  let employeeId;
  try {
    employeeId = normalizeEmployeeId(elements.employeeInput.value);
  } catch (error) {
    setResult("提示", error.message, "../assets/prizes/gift.png");
    showToast(error.message);
    resetInput();
    return;
  }

  const employeeSet = new Set(state.snapshot.employeeIds);
  if (!employeeSet.has(employeeId)) {
    await recordIneligible(employeeId);
    return;
  }

  if (hasEffectiveWinningRecord(employeeId, state.snapshot.records)) {
    setResult("提示", "您已参与过抽奖，不能重复参加", "../assets/prizes/gift.png");
    showToast("您已参与过抽奖，不能重复参加");
    resetInput();
    return;
  }

  if (!state.snapshot.prizes.some((prize) => Number(prize.remainingQty) > 0)) {
    setResult("提示", "奖品已抽完", "../assets/prizes/gift.png");
    showToast("奖品已抽完");
    resetInput();
    return;
  }

  state.activeEmployeeId = employeeId;
  state.running = true;
  state.slowing = false;
  state.pendingPrizeName = "";
  state.stopTargetIndex = -1;
  state.spinDelayIndex = 0;
  elements.employeeInput.disabled = true;
  elements.startButton.disabled = false;
  elements.startButton.innerHTML = "停止<br />抽奖";
  elements.hintText.textContent = `当前工号：${employeeId}，点击停止按钮或按空格结束抽奖`;
  setResult("抽奖中", "点击停止或按空格公布结果", "../assets/prizes/gift.png");
  clearWinnerMarks();
  advanceHighlight();
  scheduleNextHighlight(RUNNING_SPIN_INTERVALS_MS[0]);
}

async function recordIneligible(employeeId) {
  setResult("提示", "您未按时完成答题，无法参与抽奖", "../assets/prizes/gift.png");
  showToast("您未按时完成答题，无法参与抽奖");
  resetInput();
}

async function requestStopDraw() {
  if (!state.running || state.slowing || !state.activeEmployeeId) {
    return;
  }

  try {
    const selectedPrize = selectWeightedPrize(state.snapshot.prizes);
    state.pendingPrizeName = selectedPrize.name;
    state.stopTargetIndex = state.snapshot.prizes
      .slice(0, elements.prizeCards.length)
      .findIndex((prize) => prize.name === selectedPrize.name);
    state.slowing = true;
    elements.startButton.disabled = true;
    elements.startButton.innerHTML = "开奖<br />中";
    elements.hintText.textContent = "正在公布抽奖结果";
    await finalizeStoppedDraw();
  } catch (error) {
    finishRunningState();
    setResult("提示", error.message || String(error), "../assets/prizes/gift.png");
    showToast(error.message || String(error));
  }
}

async function runHighlightFrame() {
  if (!state.running) {
    return;
  }
  if (state.slowing) {
    return;
  }

  advanceHighlight();

  state.spinDelayIndex += 1;
  scheduleNextHighlight(RUNNING_SPIN_INTERVALS_MS[state.spinDelayIndex % RUNNING_SPIN_INTERVALS_MS.length]);
}

function scheduleNextHighlight(delay) {
  window.clearTimeout(state.animationTimer);
  state.animationTimer = window.setTimeout(runHighlightFrame, delay);
}

async function finalizeStoppedDraw() {
  if (!state.running || !state.activeEmployeeId || !state.pendingPrizeName) {
    return;
  }

  window.clearTimeout(state.animationTimer);
  const employeeId = state.activeEmployeeId;
  const prizeName = state.pendingPrizeName;

  try {
    const nextPrizes = state.snapshot.prizes.map((prize) => {
      if (prize.name !== prizeName) {
        return prize;
      }
      return { ...prize, remainingQty: Math.max(0, Number(prize.remainingQty) - 1) };
    });
    const snapshot = saveSnapshot({
      ...state.snapshot,
      prizes: nextPrizes,
      records: [
        ...state.snapshot.records,
        { employeeId, prizeName, time: formatNow() },
      ],
    });
    applySnapshot(snapshot);
    const resultPrize = snapshot.prizes.find((prize) => prize.name === prizeName) || { name: prizeName, imageUrl: "" };
    finishRunningState();
    setResult("恭喜您抽中", resultPrize.name, prizeImage(resultPrize));
    markWinner(resultPrize.name);
  } catch (error) {
    finishRunningState();
    loadData({ silent: true });
    setResult("提示", error.message || String(error), "../assets/prizes/gift.png");
    showToast(error.message || String(error));
  }
}

function finishRunningState() {
  window.clearTimeout(state.animationTimer);
  state.animationTimer = 0;
  state.running = false;
  state.slowing = false;
  state.activeEmployeeId = "";
  state.pendingPrizeName = "";
  state.stopTargetIndex = -1;
  elements.employeeInput.disabled = false;
  elements.startButton.disabled = false;
  elements.startButton.innerHTML = "开始<br />抽奖";
  resetInput();
}

function applySnapshot(snapshot) {
  state.snapshot = normalizeSnapshot({
    ...snapshot,
    adminPassword: configuredAdminPassword(),
  });
  state.prizeDrafts = state.snapshot.prizes.map((prize) => ({ ...prize }));
  applyActivityTitle(state.snapshot.activityTitle);
  renderPrizes();
  renderRecords();
  renderStats();
  renderAdminDialog();
}

function renderPrizes() {
  const visiblePrizes = state.snapshot.prizes.slice(0, elements.prizeCards.length);
  for (const [index, card] of elements.prizeCards.entries()) {
    const prize = visiblePrizes[index];
    card.classList.remove("active", "winner", "sold-out", "empty");
    if (!prize) {
      card.classList.add("empty");
      card.innerHTML = `<div></div><div><h3>待配置</h3></div>`;
      continue;
    }
    if (Number(prize.remainingQty) <= 0) {
      card.classList.add("sold-out");
      card.innerHTML = `
        <div class="prize-text-visual">已抽完</div>
        <div>
          <h3>${escapeHtml(prize.name)}</h3>
          <p class="sold-out-label">已抽完</p>
        </div>
      `;
      continue;
    }
    card.innerHTML = `
      ${renderPrizeVisual(prize)}
      <div>
        <h3>${escapeHtml(prize.name)}</h3>
      </div>
    `;
  }
}

function renderRecords() {
  const rows = state.snapshot.records.slice(-10).reverse();
  elements.recordsBody.innerHTML = rows
    .map((record) => {
      const className = record.prizeName === NO_QUALIFICATION_PRIZE ? "ineligible" : "";
      return `
        <tr class="${className}">
          <td>${escapeHtml(record.employeeId)}</td>
          <td>${escapeHtml(record.prizeName)}</td>
          <td>${escapeHtml(record.time)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderStats() {
  const participantCount = state.snapshot.records.filter(
    (record) => record.prizeName !== NO_QUALIFICATION_PRIZE,
  ).length;
  elements.employeeCount.textContent = `抽奖名单人数：${state.snapshot.employeeIds.length} 人`;
  elements.participantCount.textContent = `已参与人数：${participantCount} 人`;
  elements.dataStatus.textContent = `已导入名单：${state.snapshot.employeeIds.length} 人  |  中奖记录：${state.snapshot.records.length} 条`;
  elements.workbookPathText.textContent = `当前配置：${state.snapshot.configPath || LOCAL_CONFIG_LABEL}`;
}

function renderAdminDialog() {
  for (const button of elements.tabButtons) {
    button.classList.toggle("active", button.dataset.tab === state.adminTab);
  }

  if (state.adminTab === "employees") {
    renderAdminTable(["工号"], state.snapshot.employeeIds.map((employeeId) => [employeeId]));
  } else if (state.adminTab === "prizes") {
    renderPrizeSettings();
  } else {
    renderAdminTable(
      ["工号", "奖品", "时间"],
      state.snapshot.records.slice().reverse().map((record) => [record.employeeId, record.prizeName, record.time]),
    );
  }
}

function renderPrizeSettings() {
  elements.adminTableWrap.innerHTML = `
    <div class="prize-settings-header">
      <div>
        <h3>奖品设置</h3>
        <p>最多显示前 ${MAX_PRIZE_COUNT} 个奖品；图片会自动按比例适配九宫格。</p>
      </div>
      <div class="prize-settings-actions">
        <button type="button" data-admin-action="add-prize">新增奖品</button>
        <button type="button" data-admin-action="save-prizes">保存奖品设置</button>
      </div>
    </div>
    <div class="prize-editor">
      ${state.prizeDrafts.map((prize, index) => renderPrizeEditorRow(prize, index)).join("")}
    </div>
  `;
}

function renderPrizeEditorRow(prize, index) {
  return `
    <article class="prize-editor-row" data-prize-row="${index}">
      <div class="prize-preview-box">
        <div class="prize-preview-visual">
          ${renderPrizeVisual(prize)}
        </div>
        <button type="button" data-admin-action="upload-prize-image" data-prize-index="${index}">上传图片</button>
      </div>
      <label>
        <span>奖品名称</span>
        <input data-prize-field="name" value="${escapeAttribute(prize.name || "")}" maxlength="28" />
      </label>
      <label>
        <span>剩余数量</span>
        <input data-prize-field="remainingQty" type="number" min="0" max="999999" value="${Number(prize.remainingQty) || 0}" />
      </label>
      <button class="danger-button" type="button" data-admin-action="remove-prize" data-prize-index="${index}">删除</button>
    </article>
  `;
}

function renderAdminTable(headers, rows) {
  elements.adminTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .slice(0, 500)
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
}

function openAdminDialog() {
  elements.activityTitleInput.value = elements.activityTitle.textContent || DEFAULT_ACTIVITY_TITLE;
  renderAdminDialog();
  elements.adminDialog.showModal();
}

function openAdminLogin() {
  elements.adminPasswordInput.value = "";
  elements.adminLoginDialog.showModal();
  elements.adminPasswordInput.focus();
}

function verifyAdminLogin() {
  const password = String(elements.adminPasswordInput.value ?? "").trim();
  if (password !== state.snapshot.adminPassword) {
    showToast("管理员密码不正确");
    elements.adminPasswordInput.focus();
    return;
  }

  elements.adminLoginDialog.close();
  openAdminDialog();
}

function saveActivityTitle() {
  try {
    const title = normalizeActivityTitle(elements.activityTitleInput.value);
    const snapshot = saveSnapshot({ ...state.snapshot, activityTitle: title });
    applySnapshot(snapshot);
    showToast("活动标题已保存");
  } catch (error) {
    showToast(error.message || String(error));
  }
}

function normalizeActivityTitle(value) {
  const title = String(value ?? "").trim();
  return title || DEFAULT_ACTIVITY_TITLE;
}

function applyActivityTitle(title) {
  elements.activityTitle.textContent = title;
  elements.footerActivityTitle.textContent = `活动名称：${title}`;
  elements.activityTitleInput.value = title;
  document.title = title;
}

function handleAdminTableInput(event) {
  const row = event.target.closest?.("[data-prize-row]");
  const field = event.target.dataset?.prizeField;
  if (!row || !field) {
    return;
  }

  const index = Number(row.dataset.prizeRow);
  if (!state.prizeDrafts[index]) {
    return;
  }
  state.prizeDrafts[index][field] = field === "remainingQty" ? Number(event.target.value) : event.target.value;
}

function handleAdminEditablePointer(event) {
  const input = findAdminEditableInput(event.target);
  if (!input) {
    return;
  }
  queueAdminInputFocus(input);
}

function findAdminEditableInput(target) {
  if (!target?.closest) {
    return null;
  }
  if (target.matches?.("[data-prize-field]")) {
    return target;
  }

  const label = target.closest("label");
  return label?.querySelector?.("[data-prize-field]") || null;
}

async function handleAdminTableClick(event) {
  const action = event.target.dataset?.adminAction;
  if (!action) {
    return;
  }

  if (action === "add-prize") {
    syncPrizeDraftsFromDom();
    if (state.prizeDrafts.length >= elements.prizeCards.length) {
      showToast("最多配置 8 个奖品");
      return;
    }
    state.prizeDrafts.unshift({ name: "", remainingQty: 0, imagePath: "", imageUrl: "" });
    renderPrizeSettings();
    scrollPrizeSettingsTop();
    return;
  }

  if (action === "remove-prize") {
    syncPrizeDraftsFromDom();
    const index = Number(event.target.dataset.prizeIndex);
    const prizeName = state.prizeDrafts[index]?.name || "未命名奖品";
    if (!window.confirm(`确认删除奖品“${prizeName}”？删除后会立即保存。`)) {
      return;
    }
    state.prizeDrafts.splice(index, 1);
    await savePrizeSettings("奖品已删除", false);
    return;
  }

  if (action === "upload-prize-image") {
    uploadPrizeImage(Number(event.target.dataset.prizeIndex));
    return;
  }

  if (action === "save-prizes") {
    await savePrizeSettings();
  }
}

function syncPrizeDraftsFromDom() {
  const rows = [...elements.adminTableWrap.querySelectorAll("[data-prize-row]")];
  state.prizeDrafts = rows.map((row) => {
    const index = Number(row.dataset.prizeRow);
    const existing = state.prizeDrafts[index] || {};
    return {
      ...existing,
      name: row.querySelector('[data-prize-field="name"]').value,
      remainingQty: Number(row.querySelector('[data-prize-field="remainingQty"]').value) || 0,
    };
  });
}

function scrollPrizeSettingsTop() {
  elements.adminTableWrap.scrollTop = 0;
}

function queueAdminInputFocus(input) {
  const focusInput = () => {
    if (!input.isConnected) {
      return;
    }
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focusInput);
  }
  window.setTimeout(focusInput, 0);
}

function uploadPrizeImage(index) {
  if (!state.prizeDrafts[index]) {
    return;
  }
  syncPrizeDraftsFromDom();
  state.pendingPrizeImageIndex = index;
  elements.prizeImageInput.value = "";
  elements.prizeImageInput.click();
}

async function handlePrizeImageFileChange(event) {
  const file = event.target.files?.[0];
  const index = state.pendingPrizeImageIndex;
  state.pendingPrizeImageIndex = -1;
  if (!file || !state.prizeDrafts[index]) {
    return;
  }

  try {
    if (file.type && !file.type.startsWith("image/")) {
      throw new Error("请选择图片文件");
    }
    const imageUrl = await readFileAsDataUrl(file);
    state.prizeDrafts[index] = {
      ...(state.prizeDrafts[index] || { name: "", remainingQty: 0 }),
      imagePath: file.name || "",
      imageUrl,
    };
    renderPrizeSettings();
    showToast("奖品图片已选择，请保存奖品设置");
  } catch (error) {
    showToast(error.message || String(error));
  } finally {
    event.target.value = "";
  }
}

async function savePrizeSettings(message = "奖品设置已保存", shouldSyncFromDom = true) {
  try {
    if (shouldSyncFromDom) {
      syncPrizeDraftsFromDom();
    }
    const prizes = normalizePrizes(state.prizeDrafts);
    const snapshot = saveSnapshot({ ...state.snapshot, prizes });
    applySnapshot(snapshot);
    state.adminTab = "prizes";
    renderAdminDialog();
    showToast(message);
  } catch (error) {
    showToast(error.message || String(error));
  }
}

function advanceHighlight() {
  const highlightableIndexes = getHighlightablePrizeIndexes();
  if (highlightableIndexes.length === 0) {
    return;
  }
  if (state.activeIndex >= 0) {
    elements.prizeCards[state.activeIndex]?.classList.remove("active");
  }
  const currentPosition = highlightableIndexes.indexOf(state.activeIndex);
  const nextPosition = currentPosition >= 0 ? (currentPosition + 1) % highlightableIndexes.length : 0;
  state.activeIndex = highlightableIndexes[nextPosition];
  elements.prizeCards[state.activeIndex].classList.add("active");
}

function getHighlightablePrizeIndexes() {
  const visiblePrizes = state.snapshot.prizes.slice(0, elements.prizeCards.length);
  return CLOCKWISE_PRIZE_CARD_INDEXES.filter((index) => {
    const prize = visiblePrizes[index];
    return prize && Number(prize.remainingQty) > 0;
  });
}

function markWinner(prizeName) {
  clearWinnerMarks();
  const index = state.snapshot.prizes.slice(0, elements.prizeCards.length).findIndex((prize) => prize.name === prizeName);
  if (index >= 0) {
    elements.prizeCards[index].classList.add("winner");
  }
}

function clearWinnerMarks() {
  for (const card of elements.prizeCards) {
    card.classList.remove("active", "winner");
  }
  state.activeIndex = -1;
}

function resetInput() {
  elements.employeeInput.value = "";
  elements.employeeInput.disabled = false;
  if (!isAdminSurfaceOpen()) {
    elements.employeeInput.focus();
  }
  elements.hintText.textContent = "工号为7位数字；扫码枪9位编码会自动识别前7位";
}

function isAdminSurfaceOpen() {
  return elements.adminDialog.open || elements.adminLoginDialog.open;
}

function setResult(text, prize, imageSrc) {
  const mode = resultMode(text);
  elements.resultTitle.textContent =
    mode === "winner" ? "中奖结果" : mode === "status" ? "抽奖状态" : "提示信息";
  elements.resultText.textContent = text;
  elements.resultPrize.textContent = prize;
  elements.resultImage.hidden = mode !== "winner";
  elements.resultImage.src = mode === "winner" ? imageSrc || "../assets/prizes/gift.png" : "";
}

function resultMode(text) {
  if (text === "恭喜您抽中") {
    return "winner";
  }
  if (text === "等待抽奖" || text === "抽奖中") {
    return "status";
  }
  return "notice";
}

function renderPrizeVisual(prize) {
  const imageSrc = prizeImage(prize);
  if (imageSrc) {
    return `<img src="${escapeAttribute(imageSrc)}" alt="${escapeAttribute(prize.name || "奖品图片")}" />`;
  }

  return `<div class="prize-text-visual">${escapeHtml(prize.name || "奖品")}</div>`;
}

function prizeImage(prize) {
  return String(prize?.imageUrl || "").trim();
}

function readSnapshotFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createConfiguredDefaultSnapshot();
  }

  try {
    return normalizeSnapshot({
      ...JSON.parse(raw),
      adminPassword: configuredAdminPassword(),
    });
  } catch {
    return createConfiguredDefaultSnapshot();
  }
}

function saveSnapshot(snapshot) {
  const normalized = normalizeSnapshot({
    ...snapshot,
    adminPassword: configuredAdminPassword(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function createConfiguredDefaultSnapshot(overrides = {}) {
  return createDefaultSnapshot({
    adminPassword: configuredAdminPassword(),
    activityTitle: configuredDefaultActivityTitle(),
    ...overrides,
  });
}

function configuredAdminPassword() {
  const password = String(window.LOTTERY_CONFIG?.adminPassword ?? "").trim();
  return password || DEFAULT_ADMIN_PASSWORD;
}

function configuredDefaultActivityTitle() {
  const title = String(window.LOTTERY_CONFIG?.defaultActivityTitle ?? "").trim();
  return title || DEFAULT_ACTIVITY_TITLE;
}

function ensureXlsx() {
  if (!window.XLSX) {
    throw new Error("Excel组件未加载，请确认 app/vendor/xlsx.full.min.js 存在");
  }
  return window.XLSX;
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error("文件读取失败")));
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("图片读取失败")));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function startClock() {
  const update = () => {
    const now = new Date();
    const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()];
    elements.clockText.textContent = `${formatNow(now)}\n${weekday}`;
  };
  update();
  window.setInterval(update, 1000);
}

function showToast(message) {
  if (!message) {
    return;
  }
  placeToastOnVisibleSurface();
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 3000);
}

function placeToastOnVisibleSurface() {
  const host = activeToastHost();
  if (elements.toast.parentElement !== host) {
    host.append(elements.toast);
  }
}

function activeToastHost() {
  if (elements.adminDialog.open) {
    return elements.adminDialog;
  }
  if (elements.adminLoginDialog.open) {
    return elements.adminLoginDialog;
  }
  return document.body;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
