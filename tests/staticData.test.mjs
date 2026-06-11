import assert from "node:assert/strict";

import * as XLSX from "xlsx";

import {
  createDefaultSnapshot,
  employeeIdsFromWorkbook,
  normalizePrizes,
  normalizeSnapshot,
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

test("imports employee ids from a single roster sheet with a 工号 column", () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["姓名", "工号", "部门"],
    ["张三", "123456789", "EHS"],
    ["李四", "2345678", "生产"],
    ["重复", "123456700", "EHS"],
    ["无效", "ABC1234", "EHS"],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "抽奖名单");

  assert.deepEqual(employeeIdsFromWorkbook(workbook, XLSX), ["1234567", "2345678"]);
});

test("rejects roster sheets without a 工号 column", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["姓名"], ["张三"]]), "Sheet1");

  assert.throws(() => employeeIdsFromWorkbook(workbook, XLSX), /工号/);
});

test("normalizes prizes for static storage and caps them at eight", () => {
  const prizes = Array.from({ length: 10 }, (_, index) => ({
    name: `奖品${index + 1}`,
    remainingQty: String(index + 1),
    imageUrl: "",
  }));

  assert.equal(normalizePrizes(prizes).length, 8);
  assert.deepEqual(normalizePrizes([{ name: " 纸巾 ", remainingQty: "-5" }]), [
    { name: "纸巾", remainingQty: 0, imagePath: "", imageUrl: "" },
  ]);
});

test("creates and normalizes browser snapshots without workbook config files", () => {
  const snapshot = createDefaultSnapshot({ employeeIds: ["1234567", "bad"], records: [{ employeeId: "1234567" }] });

  assert.equal(snapshot.configPath, "浏览器本地存储");
  assert.equal(snapshot.adminPassword, "123456");
  assert.deepEqual(normalizeSnapshot(snapshot).employeeIds, ["1234567"]);
});

test("builds winning record rows for browser Excel export", () => {
  const rows = winningRows([
    { employeeId: "1234567", prizeName: "小风扇", time: "2026-06-04 10:00:00" },
    { employeeId: "7654321", prizeName: "无抽奖资格", time: "2026-06-04 10:01:00" },
  ]);

  assert.deepEqual(rows, [
    ["工号", "奖品", "时间"],
    ["1234567", "小风扇", "2026-06-04 10:00:00"],
  ]);
});
