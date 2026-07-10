import assert from "node:assert/strict";
import fs from "node:fs";

import * as XLSX from "xlsx";

import {
  createDefaultSnapshot,
  normalizePrizes,
  normalizeSnapshot,
  participantsFromWorkbook,
  STORAGE_KEY,
  winningRows,
} from "../app/shared/staticData.mjs";

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("imports participants from a roster sheet with 姓名 and 工号 columns", () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["姓名", "工号", "部门"],
    ["张三", "123456789", "生产"],
    ["李四", "2345678", "质量"],
    ["重复", "123456700", "生产"],
    ["无效", "ABC1234", "生产"],
    ["", "3456789", "质量"],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "抽奖名单");

  assert.deepEqual(participantsFromWorkbook(workbook, XLSX), [
    { employeeId: "1234567", name: "张三" },
    { employeeId: "2345678", name: "李四" },
  ]);
});

test("rejects roster sheets without 姓名 or 工号 columns", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["姓名"], ["张三"]]), "Sheet1");

  assert.throws(() => participantsFromWorkbook(workbook, XLSX), /姓名.*工号|工号.*姓名/);
});

test("keeps the importable sample roster workbook", () => {
  const standard = participantsFromWorkbook(readWorkbook("test-data/test-roster.xlsx"), XLSX);

  assert.equal(standard.length, 200);
  assert.deepEqual(standard[0], { name: "王明远", employeeId: "1000001" });
});

test("normalizes prizes for static storage and caps them at twelve", () => {
  const prizes = Array.from({ length: 14 }, (_, index) => ({
    name: `奖品${index + 1}`,
    description: index === 0 ? "50元小卖部卡" : "",
    remainingQty: String(index + 1),
    imageUrl: "",
  }));

  assert.equal(normalizePrizes(prizes).length, 12);
  assert.deepEqual(normalizePrizes([{ name: " 全勤参与奖 ", description: " 50元小卖部卡 ", remainingQty: "-5" }]), [
    { name: "全勤参与奖", description: "50元小卖部卡", remainingQty: 0, imagePath: "", imageUrl: "" },
  ]);
});

test("creates and normalizes browser snapshots with participant names", () => {
  const snapshot = createDefaultSnapshot({
    participants: [
      { employeeId: "123456789", name: " 张三 " },
      { employeeId: "bad", name: "无效" },
      { employeeId: "2345678", name: "" },
    ],
    records: [{ employeeId: "1234567", name: "张三", prizeName: "纪念礼品", time: "2026-06-04 10:00:00" }],
  });

  assert.equal(snapshot.configPath, "浏览器本地存储");
  assert.equal(snapshot.adminPassword, "123456");
  assert.deepEqual(normalizeSnapshot(snapshot).participants, [{ employeeId: "1234567", name: "张三" }]);
});

test("builds winning record rows with name and employee id for browser Excel export", () => {
  const rows = winningRows([
    { employeeId: "1234567", name: "张三", prizeName: "纪念礼品", time: "2026-06-04 10:00:00" },
  ]);

  assert.deepEqual(rows, [
    ["姓名", "工号", "奖品", "时间"],
    ["张三", "1234567", "纪念礼品", "2026-06-04 10:00:00"],
  ]);
});

test("uses a new storage key for the new batch lottery system", () => {
  assert.equal(STORAGE_KEY, "activity-lottery-batch-state-v1");
});

function readWorkbook(filePath) {
  return XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
}
