import assert from "node:assert/strict";
import fs from "node:fs";

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const indexHtml = fs.readFileSync("app/index.html", "utf8");
const renderer = fs.readFileSync("app/renderer.js", "utf8");

test("autosave state is not shown as explicit UI copy", () => {
  assert.doesNotMatch(indexHtml, /自动保存|数据已保存/);
  assert.doesNotMatch(renderer, /自动保存|数据已保存/);
});
