export const STORAGE_KEY = "ehs-lottery-static-state-v1";
export const NO_QUALIFICATION_PRIZE = "无抽奖资格";
export const DEFAULT_ADMIN_PASSWORD = "123456";
export const DEFAULT_ACTIVITY_TITLE = "活动抽奖";
export const LOCAL_CONFIG_LABEL = "浏览器本地存储";
export const MAX_PRIZE_COUNT = 8;

export const DEFAULT_PRIZES = [
  { name: "小风扇", remainingQty: 30, imagePath: "fan.png", imageUrl: "../assets/prizes/fan.png" },
  { name: "指甲刀套装", remainingQty: 30, imagePath: "nail_kit.png", imageUrl: "../assets/prizes/nail_kit.png" },
  { name: "天堂伞", remainingQty: 30, imagePath: "umbrella.png", imageUrl: "../assets/prizes/umbrella.png" },
  { name: "护手霜", remainingQty: 30, imagePath: "hand_cream.png", imageUrl: "../assets/prizes/hand_cream.png" },
  { name: "冰袖", remainingQty: 30, imagePath: "sleeves.png", imageUrl: "../assets/prizes/sleeves.png" },
  { name: "休闲书包", remainingQty: 30, imagePath: "backpack.png", imageUrl: "../assets/prizes/backpack.png" },
  { name: "软抽纸面巾", remainingQty: 30, imagePath: "tissue.png", imageUrl: "../assets/prizes/tissue.png" },
  { name: "10元小卖部购物券", remainingQty: 4600, imagePath: "coupon.png", imageUrl: "../assets/prizes/coupon.png" },
];

export function createDefaultSnapshot(overrides = {}) {
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

export function normalizeSnapshot(snapshot = {}) {
  const employeeIds = uniqueValues(
    ensureArray(snapshot.employeeIds)
      .map((employeeId) => normalizeImportedEmployeeId(employeeId))
      .filter(Boolean),
  );

  return {
    workbookPath: LOCAL_CONFIG_LABEL,
    configPath: LOCAL_CONFIG_LABEL,
    adminPassword: normalizeAdminPassword(snapshot.adminPassword),
    activityTitle: normalizeActivityTitle(snapshot.activityTitle),
    employeeIds,
    prizes: normalizePrizes(snapshot.prizes),
    records: normalizeRecords(snapshot.records),
  };
}

export function normalizePrizes(prizes) {
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

export function employeeIdsFromWorkbook(workbook, XLSX) {
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

export function winningRows(records) {
  return [
    ["工号", "奖品", "时间"],
    ...normalizeRecords(records).map((record) => [record.employeeId, record.prizeName, record.time]),
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
