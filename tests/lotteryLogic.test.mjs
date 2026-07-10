import assert from "node:assert/strict";

import { drawAllWinners, formatNow } from "../app/shared/lotteryLogic.mjs";

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("drawAllWinners assigns all available prize slots to unique participants", () => {
  const participants = [
    { employeeId: "1000001", name: "王晨" },
    { employeeId: "1000002", name: "李佳" },
    { employeeId: "1000003", name: "陈宇" },
  ];
  const prizes = [
    { name: "蓝牙耳机", remainingQty: 2 },
    { name: "保温杯", remainingQty: 1 },
  ];

  const result = drawAllWinners(participants, prizes, () => 0, new Date(2026, 8, 1, 10, 25, 31));

  assert.deepEqual(result.records, [
    { employeeId: "1000001", name: "王晨", prizeName: "蓝牙耳机", time: "2026-09-01 10:25:31" },
    { employeeId: "1000002", name: "李佳", prizeName: "蓝牙耳机", time: "2026-09-01 10:25:31" },
    { employeeId: "1000003", name: "陈宇", prizeName: "保温杯", time: "2026-09-01 10:25:31" },
  ]);
  assert.deepEqual(result.prizes, [
    { name: "蓝牙耳机", remainingQty: 0 },
    { name: "保温杯", remainingQty: 0 },
  ]);
});

test("drawAllWinners stops at the smaller of participant count and prize stock", () => {
  const result = drawAllWinners(
    [{ employeeId: "1000001", name: "王晨" }],
    [{ name: "蓝牙耳机", remainingQty: 3 }],
    () => 0,
    new Date(2026, 8, 1, 10, 25, 31),
  );

  assert.equal(result.records.length, 1);
  assert.deepEqual(result.prizes, [{ name: "蓝牙耳机", remainingQty: 2 }]);
});

test("drawAllWinners requires participants and available stock", () => {
  assert.throws(() => drawAllWinners([], [{ name: "蓝牙耳机", remainingQty: 1 }]), /请先导入抽奖名单/);
  assert.throws(() => drawAllWinners([{ employeeId: "1000001", name: "王晨" }], []), /奖品已抽完/);
});

test("formatNow returns Excel-friendly local timestamp", () => {
  const date = new Date(2026, 8, 1, 10, 25, 31);

  assert.equal(formatNow(date), "2026-09-01 10:25:31");
});
