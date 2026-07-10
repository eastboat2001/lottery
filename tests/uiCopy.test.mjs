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

test("front stage avoids explanatory process copy", () => {
  const combinedCopy = `${indexHtml}\n${renderer}`;

  assert.doesNotMatch(
    combinedCopy,
    /先播放动画，再公布完整名单|正在生成中奖名单|系统正在随机分配奖品名额|动画结束后公布完整中奖名单|导入名单和奖品后，一键完成抽奖/,
  );
  assert.doesNotMatch(combinedCopy, /右侧展示区会自动调整展示密度/);
  assert.doesNotMatch(indexHtml, /<button id="startButton"[\s\S]*?<small>/);
  assert.doesNotMatch(renderer, /startButton\.innerHTML[\s\S]*?<small>/);
});

test("front stage uses AT&S branding and omits remaining prize stock card", () => {
  assert.match(indexHtml, /class="brand-mark"[\s\S]*AT&amp;S/);
  assert.doesNotMatch(indexHtml, /Lucky Draw|LUCKY\s*DRAW/i);
  assert.doesNotMatch(indexHtml, /奖品数量|id="prizeCount"/);
  assert.doesNotMatch(renderer, /prizeCount:\s*document\.querySelector|elements\.prizeCount/);
});
