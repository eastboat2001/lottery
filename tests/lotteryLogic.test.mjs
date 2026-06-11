import assert from "node:assert/strict";

import {
  formatNow,
  hasEffectiveWinningRecord,
  normalizeEmployeeId,
  NO_QUALIFICATION_PRIZE,
  RUNNING_SPIN_INTERVALS_MS,
  selectWeightedPrize,
} from "../app/shared/lotteryLogic.mjs";

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("normalizeEmployeeId keeps 7-digit manual employee id", () => {
  assert.equal(normalizeEmployeeId(" 1234567 "), "1234567");
});

test("normalizeEmployeeId keeps first 7 digits from scanner input", () => {
  assert.equal(normalizeEmployeeId("123456701\r\n"), "1234567");
});

test("normalizeEmployeeId rejects empty input", () => {
  assert.throws(() => normalizeEmployeeId("   "), /请输入或扫描工号/);
});

test("normalizeEmployeeId rejects short input", () => {
  assert.throws(() => normalizeEmployeeId("12345"), /请输入正确的工号/);
});

test("normalizeEmployeeId rejects non-digit first seven characters", () => {
  assert.throws(() => normalizeEmployeeId("1234A6701"), /请输入正确的工号/);
});

test("hasEffectiveWinningRecord ignores no-qualification records", () => {
  const records = [
    { employeeId: "1234567", prizeName: NO_QUALIFICATION_PRIZE, time: "2026-09-01 10:00:00" },
  ];

  assert.equal(hasEffectiveWinningRecord("1234567", records), false);
});

test("hasEffectiveWinningRecord detects real winning records", () => {
  const records = [
    { employeeId: "1234567", prizeName: "天堂伞", time: "2026-09-01 10:00:00" },
  ];

  assert.equal(hasEffectiveWinningRecord("1234567", records), true);
});

test("selectWeightedPrize uses remaining stock as weight", () => {
  const prizes = [
    { name: "小风扇", remainingQty: 1 },
    { name: "10元小卖部购物券", remainingQty: 5 },
  ];

  assert.equal(selectWeightedPrize(prizes, () => 0.8).name, "10元小卖部购物券");
});

test("selectWeightedPrize skips zero-stock prizes", () => {
  const prizes = [
    { name: "小风扇", remainingQty: 0 },
    { name: "天堂伞", remainingQty: 1 },
  ];

  assert.equal(selectWeightedPrize(prizes, () => 0).name, "天堂伞");
});

test("selectWeightedPrize reports empty stock", () => {
  assert.throws(() => selectWeightedPrize([{ name: "小风扇", remainingQty: 0 }]), /奖品已抽完/);
});

test("formatNow returns Excel-friendly local timestamp", () => {
  const date = new Date(2026, 8, 1, 10, 25, 31);

  assert.equal(formatNow(date), "2026-09-01 10:25:31");
});

test("running spin intervals are fast and subtly non-uniform", () => {
  assert.ok(RUNNING_SPIN_INTERVALS_MS.length >= 4);
  assert.ok(
    RUNNING_SPIN_INTERVALS_MS.every((interval) => interval >= 20 && interval <= 36),
    "running intervals should keep the prize highlight moving quickly",
  );
  assert.ok(new Set(RUNNING_SPIN_INTERVALS_MS).size > 1, "intervals should not be perfectly uniform");
});
