const STORAGE_KEY = "activity-lottery-batch-state-v1";
const DEFAULT_ADMIN_PASSWORD = "123456";
const DEFAULT_ACTIVITY_TITLE = "活动抽奖";
const LOCAL_CONFIG_LABEL = "浏览器本地存储";
const MIN_PRIZE_COUNT = 1;
const MAX_PRIZE_COUNT = 12;
const DRAW_ANIMATION_MS = 1600;
const COMPACT_WINNER_GRID_LIMIT = 36;

const DEFAULT_PRIZES = [
  { name: "全勤参与奖", description: "50元小卖部卡", remainingQty: 36, imagePath: "", imageUrl: "" },
];

function createDefaultSnapshot(overrides = {}) {
  return normalizeSnapshot({
    workbookPath: LOCAL_CONFIG_LABEL,
    configPath: LOCAL_CONFIG_LABEL,
    adminPassword: DEFAULT_ADMIN_PASSWORD,
    activityTitle: DEFAULT_ACTIVITY_TITLE,
    participants: [],
    prizes: DEFAULT_PRIZES,
    records: [],
    ...overrides,
  });
}

function normalizeSnapshot(snapshot = {}) {
  return {
    workbookPath: LOCAL_CONFIG_LABEL,
    configPath: LOCAL_CONFIG_LABEL,
    adminPassword: normalizeAdminPassword(snapshot.adminPassword),
    activityTitle: normalizeActivityTitleValue(snapshot.activityTitle),
    participants: normalizeParticipants(snapshot.participants),
    prizes: normalizePrizes(snapshot.prizes),
    records: normalizeRecords(snapshot.records),
  };
}

function normalizePrizes(prizes) {
  const seen = new Set();

  return ensureArray(prizes)
    .map((prize) => ({
      name: String(prize?.name ?? "").trim(),
      description: String(prize?.description ?? "").trim(),
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

function participantsFromWorkbook(workbook, XLSX) {
  if (!workbook?.SheetNames?.length) {
    throw new Error("抽奖名单文件中没有可读取的工作表");
  }

  const sheetName = workbook.Sheets["抽奖名单"] ? "抽奖名单" : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const header = rows[0] || [];
  const nameColumnIndex = header.findIndex((cell) => String(cell ?? "").trim() === "姓名");
  const employeeColumnIndex = header.findIndex((cell) => String(cell ?? "").trim() === "工号");

  if (nameColumnIndex < 0 || employeeColumnIndex < 0) {
    throw new Error("导入名单必须同时包含“姓名”和“工号”列");
  }

  const participants = rows
    .slice(1)
    .map((row) => ({
      name: normalizeParticipantName(row[nameColumnIndex]),
      employeeId: normalizeImportedEmployeeId(row[employeeColumnIndex]),
    }))
    .filter((participant) => participant.employeeId && participant.name);

  const uniqueParticipants = uniqueParticipantsByEmployeeId(participants);
  if (uniqueParticipants.length === 0) {
    throw new Error("导入名单中没有可用的姓名和7位工号");
  }

  return uniqueParticipants;
}

function winningRows(records) {
  return [
    ["姓名", "工号", "奖品", "时间"],
    ...normalizeRecords(records).map((record) => [record.name, record.employeeId, record.prizeName, record.time]),
  ];
}

function drawAllWinners(participants, prizes, random = Math.random, date = new Date()) {
  const availableParticipants = participants
    .map((participant) => ({
      employeeId: String(participant?.employeeId ?? "").trim(),
      name: String(participant?.name ?? "").trim(),
    }))
    .filter((participant) => participant.employeeId && participant.name);
  if (availableParticipants.length === 0) {
    throw new Error("请先导入抽奖名单");
  }

  const prizeSlots = prizes
    .flatMap((prize) =>
      Array.from({ length: Math.max(0, Math.trunc(Number(prize?.remainingQty) || 0)) }, () => ({
        prizeName: String(prize?.name ?? "").trim(),
      })),
    )
    .filter((slot) => slot.prizeName);
  if (prizeSlots.length === 0) {
    throw new Error("奖品已抽完");
  }

  const shuffledParticipants = shuffle(availableParticipants, random);
  const shuffledSlots = shuffle(prizeSlots, random);
  const winnerCount = Math.min(shuffledParticipants.length, shuffledSlots.length);
  const time = formatNow(date);
  const records = Array.from({ length: winnerCount }, (_, index) => ({
    employeeId: shuffledParticipants[index].employeeId,
    name: shuffledParticipants[index].name,
    prizeName: shuffledSlots[index].prizeName,
    time,
  }));
  const awardedCounts = records.reduce((counts, record) => {
    counts.set(record.prizeName, (counts.get(record.prizeName) || 0) + 1);
    return counts;
  }, new Map());

  return {
    records,
    prizes: prizes.map((prize) => ({
      ...prize,
      remainingQty: Math.max(0, Math.trunc(Number(prize.remainingQty) || 0) - (awardedCounts.get(prize.name) || 0)),
    })),
  };
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

function shuffle(values, random) {
  const shuffled = values.map((value) => ({ ...value }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = index - Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function normalizeParticipants(participants) {
  return uniqueParticipantsByEmployeeId(
    ensureArray(participants)
      .map((participant) => ({
        employeeId: normalizeImportedEmployeeId(participant?.employeeId),
        name: normalizeParticipantName(participant?.name),
      }))
      .filter((participant) => participant.employeeId && participant.name),
  );
}

function normalizeRecords(records) {
  return ensureArray(records)
    .map((record) => ({
      employeeId: normalizeImportedEmployeeId(record?.employeeId),
      name: normalizeParticipantName(record?.name),
      prizeName: String(record?.prizeName ?? "").trim(),
      time: String(record?.time ?? "").trim(),
    }))
    .filter((record) => record.employeeId && record.prizeName);
}

function normalizeImportedEmployeeId(value) {
  const text = String(value ?? "").trim().replace(/[\s\r\n\t]+/g, "");
  const employeeId = text.slice(0, 7);
  return /^\d{7}$/.test(employeeId) ? employeeId : "";
}

function normalizeParticipantName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeActivityTitleValue(value) {
  const title = String(value ?? "").trim();
  return title || DEFAULT_ACTIVITY_TITLE;
}

function normalizeAdminPassword(value) {
  const password = String(value ?? "").trim();
  return password || DEFAULT_ADMIN_PASSWORD;
}

function uniqueParticipantsByEmployeeId(participants) {
  const seen = new Set();
  return participants.filter((participant) => {
    if (seen.has(participant.employeeId)) {
      return false;
    }
    seen.add(participant.employeeId);
    return true;
  });
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

const elements = {
  activityTitle: document.querySelector("#activityTitle"),
  footerActivityTitle: document.querySelector("#footerActivityTitle"),
  activityTitleInput: document.querySelector("#activityTitleInput"),
  adminLoginDialog: document.querySelector("#adminLoginDialog"),
  adminPasswordInput: document.querySelector("#adminPasswordInput"),
  loginSubmitButton: document.querySelector("#loginSubmitButton"),
  clockText: document.querySelector("#clockText"),
  drawStatusText: document.querySelector("#drawStatusText"),
  dataStatus: document.querySelector("#dataStatus"),
  importButton: document.querySelector("#importButton"),
  exportButton: document.querySelector("#exportButton"),
  refreshButton: document.querySelector("#refreshButton"),
  adminButton: document.querySelector("#adminButton"),
  startButton: document.querySelector("#startButton"),
  showcasePanel: document.querySelector("#showcasePanel"),
  showcaseTitle: document.querySelector("#showcaseTitle"),
  showcaseMeta: document.querySelector("#showcaseMeta"),
  prizeShowcase: document.querySelector("#prizeShowcase"),
  winnersShowcase: document.querySelector("#winnersShowcase"),
  winnerTicker: document.querySelector("#winnerTicker"),
  drawAnimation: document.querySelector("#drawAnimation"),
  employeeCount: document.querySelector("#employeeCount"),
  winnerCount: document.querySelector("#winnerCount"),
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
  pendingDrawResult: null,
  animationTimer: 0,
  running: false,
  adminTab: "employees",
};

bindEvents();
loadData({ silent: true });
updateClock();
window.setInterval(updateClock, 1000);

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
  elements.startButton.addEventListener("click", startBatchDraw);

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
    if (!options.silent) {
      showToast("数据已刷新");
    }
  } catch (error) {
    showToast(error.message || String(error));
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
    const participants = participantsFromWorkbook(workbook, XLSX);
    const snapshot = saveSnapshot({ ...state.snapshot, participants, records: [] });
    applySnapshot(snapshot);
    showToast(`抽奖名单已导入：${participants.length} 人`);
  } catch (error) {
    showToast(error.message || String(error));
  } finally {
    event.target.value = "";
  }
}

function resetAllData() {
  if (!window.confirm("确认重置抽奖名单、中奖记录和奖品设置？管理员密码和活动标题会保留。")) {
    return;
  }

  try {
    window.clearTimeout(state.animationTimer);
    state.running = false;
    state.pendingDrawResult = null;
    const snapshot = saveSnapshot(
      createDefaultSnapshot({
        adminPassword: configuredAdminPassword(),
        activityTitle: state.snapshot.activityTitle,
      }),
    );
    applySnapshot(snapshot);
    showToast("数据已重置");
  } catch (error) {
    showToast(error.message || String(error));
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

function startBatchDraw() {
  if (state.running) {
    return;
  }
  if (state.snapshot.records.length > 0) {
    setDrawStatus("已完成");
    showToast("请先重置数据");
    return;
  }

  try {
    state.pendingDrawResult = drawAllWinners(state.snapshot.participants, state.snapshot.prizes);
    state.running = true;
    elements.startButton.disabled = true;
    elements.startButton.innerHTML = "<span>抽奖中</span>";
    setDrawStatus("抽奖中");
    renderDrawingAnimation();
    window.clearTimeout(state.animationTimer);
    state.animationTimer = window.setTimeout(finalizeBatchDraw, DRAW_ANIMATION_MS);
  } catch (error) {
    const message = compactDrawErrorMessage(error.message || String(error));
    setDrawStatus(message);
    showToast(message);
  }
}

function finalizeBatchDraw() {
  if (!state.running || !state.pendingDrawResult) {
    return;
  }

  try {
    const snapshot = saveSnapshot({
      ...state.snapshot,
      prizes: state.pendingDrawResult.prizes,
      records: state.pendingDrawResult.records,
    });
    state.running = false;
    state.pendingDrawResult = null;
    state.animationTimer = 0;
    elements.startButton.disabled = false;
    applySnapshot(snapshot);
    showToast(`抽奖完成：${snapshot.records.length} 人中奖`);
  } catch (error) {
    state.running = false;
    state.pendingDrawResult = null;
    state.animationTimer = 0;
    elements.startButton.disabled = false;
    loadData({ silent: true });
    setDrawStatus(error.message || String(error));
    showToast(error.message || String(error));
  }
}

function applySnapshot(snapshot) {
  state.snapshot = normalizeSnapshot({
    ...snapshot,
    adminPassword: configuredAdminPassword(),
  });
  state.prizeDrafts = state.snapshot.prizes.map((prize) => ({ ...prize }));
  applyActivityTitle(state.snapshot.activityTitle);
  renderStage();
  renderStats();
  renderAdminDialog();
}

function renderStage() {
  if (state.running) {
    renderDrawingAnimation();
    return;
  }
  if (state.snapshot.records.length > 0) {
    renderWinners();
    return;
  }
  renderPrizes();
}

function renderPrizes() {
  resetWinnerScrollPosition();
  const prizeCount = state.snapshot.prizes.length;
  elements.showcasePanel.classList.remove("showing-winners", "drawing");
  elements.prizeShowcase.className = `prize-showcase ${prizeDensityClass(prizeCount)} prize-count-${Math.min(
    Math.max(prizeCount, 0),
    MAX_PRIZE_COUNT,
  )}`;
  elements.prizeShowcase.hidden = false;
  elements.winnersShowcase.hidden = true;
  elements.drawAnimation.hidden = true;
  elements.showcaseTitle.textContent = "奖品信息";
  elements.showcaseMeta.textContent = `${state.snapshot.prizes.length} 类奖品 · 共 ${availablePrizeCount()} 个名额`;
  setDrawStatus(state.snapshot.participants.length ? "待抽奖" : "请导入名单");

  elements.prizeShowcase.innerHTML = state.snapshot.prizes.length
    ? state.snapshot.prizes.map((prize) => renderPrizeCard(prize)).join("")
    : `<div class="empty-state">请在管理员功能中配置奖品</div>`;
  updateStartButton();
}

function prizeDensityClass(prizeCount) {
  if (prizeCount <= 6) {
    return "prize-density-spacious";
  }
  if (prizeCount >= 10) {
    return "prize-density-compact";
  }
  return "prize-density-standard";
}

function renderDrawingAnimation() {
  resetWinnerScrollPosition();
  elements.showcasePanel.classList.remove("showing-winners");
  elements.showcasePanel.classList.add("drawing");
  elements.prizeShowcase.hidden = true;
  elements.winnersShowcase.hidden = true;
  elements.drawAnimation.hidden = false;
  elements.showcaseTitle.textContent = "抽奖中";
  elements.showcaseMeta.textContent = "";
}

function renderWinners() {
  const records = state.snapshot.records;
  resetWinnerScrollPosition();
  elements.showcasePanel.classList.remove("drawing");
  elements.showcasePanel.classList.add("showing-winners");
  elements.prizeShowcase.hidden = true;
  elements.winnersShowcase.hidden = false;
  elements.drawAnimation.hidden = true;
  elements.showcaseTitle.textContent = "中奖名单";
  elements.showcaseMeta.textContent = `${records.length} 位中奖者 · ${uniquePrizeCount(records)} 类奖品`;
  setDrawStatus("抽奖已完成");
  elements.winnerTicker.classList.toggle("compact-grid", records.length > 0 && records.length <= COMPACT_WINNER_GRID_LIMIT);
  elements.winnerTicker.classList.toggle("scrolling", records.length > COMPACT_WINNER_GRID_LIMIT);
  const winnerRows = records
    .map(
      (record, index) => `
          <article class="winner-row">
            <span class="winner-index">${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(record.name || "未命名")}</strong>
            <span class="winner-employee-id">${escapeHtml(record.employeeId)}</span>
            <em>${escapeHtml(record.prizeName)}</em>
          </article>
        `,
    )
    .join("");
  elements.winnerTicker.innerHTML = `<div class="winner-track">${winnerRows}</div>`;
  updateStartButton();
}

function resetWinnerScrollPosition() {
  elements.winnerTicker.scrollTop = 0;
}

function renderPrizeCard(prize) {
  const remainingQty = Number(prize.remainingQty) || 0;
  const soldOut = remainingQty <= 0;
  const description = String(prize.description || "").trim();
  const certificate = prizeCertificateDetails(prize);
  const imageSrc = prizeImage(prize);
  return `
    <article class="prize-card ${soldOut ? "sold-out" : ""}">
      <div class="prize-card-hero">
        <div class="prize-stage-rings" aria-hidden="true"></div>
        <div class="prize-certificate ${imageSrc ? "has-image" : ""}">
          ${
            imageSrc
              ? `<img class="prize-certificate-image" src="${escapeAttribute(imageSrc)}" alt="${escapeAttribute(
                  prize.name || "奖品图片",
                )}" />`
              : `
                <span class="prize-certificate-label">${escapeHtml(certificate.label)}</span>
                <span class="prize-certificate-amount">${escapeHtml(certificate.amount)}</span>
                <span class="prize-certificate-unit">${escapeHtml(certificate.unit)}</span>
                <span class="prize-certificate-type">${escapeHtml(certificate.type)}</span>
                <span class="prize-certificate-icon" aria-hidden="true"></span>
              `
          }
        </div>
        <div class="prize-stage-base" aria-hidden="true"></div>
      </div>
      <div class="prize-info">
        <h3>${escapeHtml(prize.name)}</h3>
        ${description ? `<p class="prize-description">${escapeHtml(description)}</p>` : ""}
        <p class="prize-quota">${soldOut ? "已抽完" : `${remainingQty} 个名额`}</p>
      </div>
    </article>
  `;
}

function prizeCertificateDetails(prize) {
  const name = String(prize?.name || "奖品").trim();
  const description = String(prize?.description || "").trim();
  const amountMatch = description.match(/(\d+(?:\.\d+)?)\s*元/);
  if (!amountMatch) {
    return {
      label: name,
      amount: description || name,
      unit: "",
      type: "礼品",
    };
  }

  const type = description.replace(amountMatch[0], "").trim() || name;
  return {
    label: type.replace(/卡$/, "") || name,
    amount: amountMatch[1],
    unit: "元",
    type,
  };
}

function renderStats() {
  elements.employeeCount.textContent = String(state.snapshot.participants.length);
  if (elements.participantCount) {
    elements.participantCount.textContent = `抽奖名单人数：${state.snapshot.participants.length} 人`;
  }
  elements.winnerCount.textContent = String(state.snapshot.records.length);
  elements.dataStatus.textContent = `已导入名单：${state.snapshot.participants.length} 人  |  中奖记录：${state.snapshot.records.length} 条`;
  elements.workbookPathText.textContent = `当前配置：${state.snapshot.configPath || LOCAL_CONFIG_LABEL}`;
}

function availablePrizeCount() {
  return state.snapshot.prizes.reduce((sum, prize) => sum + Math.max(0, Number(prize.remainingQty) || 0), 0);
}

function uniquePrizeCount(records) {
  return new Set(records.map((record) => record.prizeName)).size;
}

function updateStartButton() {
  if (state.snapshot.records.length > 0) {
    elements.startButton.disabled = false;
    elements.startButton.innerHTML = "<span>抽奖完成</span>";
    return;
  }
  elements.startButton.disabled = false;
  elements.startButton.innerHTML = "<span>一键抽奖</span>";
}

function setDrawStatus(message) {
  elements.drawStatusText.textContent = message;
}

function compactDrawErrorMessage(message) {
  return message === "请先导入抽奖名单" ? "请导入名单" : message;
}

function renderAdminDialog() {
  for (const button of elements.tabButtons) {
    button.classList.toggle("active", button.dataset.tab === state.adminTab);
  }

  if (state.adminTab === "employees") {
    renderAdminTable(["姓名", "工号"], state.snapshot.participants.map((participant) => [participant.name, participant.employeeId]));
  } else if (state.adminTab === "prizes") {
    renderPrizeSettings();
  } else {
    renderAdminTable(
      ["姓名", "工号", "奖品", "时间"],
      state.snapshot.records
        .slice()
        .reverse()
        .map((record) => [record.name, record.employeeId, record.prizeName, record.time]),
    );
  }
}

function renderPrizeSettings() {
  elements.adminTableWrap.innerHTML = `
    <div class="prize-settings-header">
      <div>
        <h3>奖品设置</h3>
        <p>${MIN_PRIZE_COUNT}-${MAX_PRIZE_COUNT} 种奖品</p>
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
  const description = String(prize?.description ?? "");
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
      <label class="prize-description-field">
        <span>奖品描述</span>
        <textarea data-prize-field="description" maxlength="80" rows="3">${escapeHtml(description)}</textarea>
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

function openAdminLogin() {
  elements.adminPasswordInput.value = "";
  elements.adminLoginDialog.showModal();
  elements.adminPasswordInput.focus();
}

function verifyAdminLogin() {
  if (elements.adminPasswordInput.value !== configuredAdminPassword()) {
    showToast("管理员密码错误");
    elements.adminPasswordInput.value = "";
    elements.adminPasswordInput.focus();
    return;
  }
  elements.adminLoginDialog.close();
  elements.adminDialog.showModal();
  state.adminTab = "employees";
  renderAdminDialog();
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

function handleAdminEditablePointer(event) {
  const input = findAdminEditableInput(event.target);
  if (!input) {
    return;
  }
  queueAdminInputFocus(input);
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

async function handleAdminTableClick(event) {
  const action = event.target.dataset?.adminAction;
  if (!action) {
    return;
  }

  if (action === "add-prize") {
    syncPrizeDraftsFromDom();
    if (state.prizeDrafts.length >= MAX_PRIZE_COUNT) {
      showToast("最多配置 12 个奖品");
      return;
    }
    state.prizeDrafts.unshift({ name: "", description: "", remainingQty: 0, imagePath: "", imageUrl: "" });
    renderPrizeSettings();
    scrollPrizeSettingsTop();
    return;
  }

  if (action === "remove-prize") {
    syncPrizeDraftsFromDom();
    const index = Number(event.target.dataset.prizeIndex);
    const isRemovingNamedPrize = String(state.prizeDrafts[index]?.name ?? "").trim();
    if (isRemovingNamedPrize && countValidPrizeDrafts(state.prizeDrafts) <= MIN_PRIZE_COUNT) {
      showToast("至少保留 1 个奖品");
      return;
    }
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

function findAdminEditableInput(target) {
  if (target?.matches?.(".admin-table-wrap input, .admin-table-wrap textarea, .admin-table-wrap select")) {
    return target;
  }
  return target?.closest?.(".admin-table-wrap input, .admin-table-wrap textarea, .admin-table-wrap select") || null;
}

function queueAdminInputFocus(input) {
  window.setTimeout(() => {
    if (input?.isConnected) {
      input.focus();
    }
  }, 0);
}

function syncPrizeDraftsFromDom() {
  const rows = elements.adminTableWrap.querySelectorAll?.("[data-prize-row]") || [];
  for (const row of rows) {
    const index = Number(row.dataset.prizeRow);
    const draft = state.prizeDrafts[index];
    if (!draft) {
      continue;
    }
    for (const input of row.querySelectorAll("[data-prize-field]")) {
      const field = input.dataset.prizeField;
      draft[field] = field === "remainingQty" ? Number(input.value) : input.value;
    }
  }
}

function countValidPrizeDrafts(prizeDrafts) {
  return normalizePrizes(prizeDrafts).length;
}

function uploadPrizeImage(index) {
  if (!state.prizeDrafts[index]) {
    return;
  }
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
      ...(state.prizeDrafts[index] || { name: "", description: "", remainingQty: 0 }),
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
    const prizes = validatePrizeDraftsForSave(state.prizeDrafts);
    const snapshot = saveSnapshot({ ...state.snapshot, prizes, records: [] });
    applySnapshot(snapshot);
    state.adminTab = "prizes";
    renderAdminDialog();
    showToast(message);
  } catch (error) {
    showToast(error.message || String(error));
  }
}

function validatePrizeDraftsForSave(prizeDrafts) {
  const validPrizes = normalizePrizes(prizeDrafts);
  if (validPrizes.length < MIN_PRIZE_COUNT) {
    throw new Error("请至少配置 1 个有效奖品");
  }
  return validPrizes;
}

function scrollPrizeSettingsTop() {
  elements.adminTableWrap.scrollTop = 0;
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
    throw new Error("Excel 组件未加载");
  }
  return window.XLSX;
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateClock() {
  elements.clockText.textContent = formatNow();
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
  const host = elements.adminDialog.open
    ? elements.adminDialog
    : elements.adminLoginDialog.open
      ? elements.adminLoginDialog
      : document.body;
  if (elements.toast.parentElement !== host) {
    host.append(elements.toast);
  }
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
