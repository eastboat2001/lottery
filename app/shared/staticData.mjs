export const STORAGE_KEY = "activity-lottery-batch-state-v1";
export const DEFAULT_ADMIN_PASSWORD = "123456";
export const DEFAULT_ACTIVITY_TITLE = "活动抽奖";
export const LOCAL_CONFIG_LABEL = "浏览器本地存储";
export const MAX_PRIZE_COUNT = 12;

export const DEFAULT_PRIZES = [
  { name: "全勤参与奖", description: "50元小卖部卡", remainingQty: 36, imagePath: "", imageUrl: "" },
];

export function createDefaultSnapshot(overrides = {}) {
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

export function normalizeSnapshot(snapshot = {}) {
  return {
    workbookPath: LOCAL_CONFIG_LABEL,
    configPath: LOCAL_CONFIG_LABEL,
    adminPassword: normalizeAdminPassword(snapshot.adminPassword),
    activityTitle: normalizeActivityTitle(snapshot.activityTitle),
    participants: normalizeParticipants(snapshot.participants),
    prizes: normalizePrizes(snapshot.prizes),
    records: normalizeRecords(snapshot.records),
  };
}

export function normalizePrizes(prizes) {
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

export function participantsFromWorkbook(workbook, XLSX) {
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

export function winningRows(records) {
  return [
    ["姓名", "工号", "奖品", "时间"],
    ...normalizeRecords(records).map((record) => [record.name, record.employeeId, record.prizeName, record.time]),
  ];
}

function normalizeActivityTitle(value) {
  const title = String(value ?? "").trim();
  return title || DEFAULT_ACTIVITY_TITLE;
}

function normalizeAdminPassword(value) {
  const password = String(value ?? "").trim();
  return password || DEFAULT_ADMIN_PASSWORD;
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
