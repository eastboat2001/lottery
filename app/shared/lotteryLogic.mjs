export const NO_QUALIFICATION_PRIZE = "无抽奖资格";
export const RUNNING_SPIN_INTERVALS_MS = [24, 29, 34, 26, 32];

export function normalizeEmployeeId(rawInput) {
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

export function hasEffectiveWinningRecord(employeeId, records) {
  return records.some(
    (record) => record.employeeId === employeeId && record.prizeName !== NO_QUALIFICATION_PRIZE,
  );
}

export function selectWeightedPrize(prizes, random = Math.random) {
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

export function formatNow(date = new Date()) {
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
