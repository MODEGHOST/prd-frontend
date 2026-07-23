import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("date pickers default to read-only input so mobile keyboards stay closed", async () => {
  const picker = await read("../src/components/ui/AppDatePicker.jsx");
  assert.match(picker, /inputReadOnly = true/);
  assert.match(picker, /inputReadOnly=\{inputReadOnly\}/);
  assert.match(picker, /app-picker-dropdown/);
});

test("mobile picker styles fit one month and move presets above the calendar", async () => {
  const css = await read("../src/styles.css");
  assert.match(css, /\.app-picker-dropdown/);
  assert.match(css, /@media \(max-width:\s*640px\)/);
  assert.match(css, /ant-picker-panel-layout/);
  assert.match(css, /flex-direction:\s*column\s*!important/);
  assert.match(css, /ant-picker-panel:nth-child\(n \+ 2\)/);
  assert.match(css, /display:\s*none\s*!important/);
  // Desktop rules for menus/gantt must remain outside the mobile picker block impact surface
  assert.match(css, /\.project-plan-gantt/);
  assert.match(css, /\.kanban-column/);
});
