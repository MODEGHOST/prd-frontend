import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const board = await readFile(
  new URL("../src/pages/BoardPage.jsx", import.meta.url),
  "utf8",
);

test("board starts with searchable project and standalone-ticket cards", () => {
  assert.match(board, /useState\("overview"\)/);
  assert.match(board, /ค้นหาชื่อ รหัสโครงการ หรือเลข Ticket/);
  assert.match(board, /boardApi[\s\S]*\.overview\(\{/);
  assert.match(board, /limit: 6/);
  assert.match(board, /<Pagination/);
  assert.match(board, /pageSize=\{6\}/);
  assert.match(board, /เปิดกระดาน/);
  assert.match(board, /className="mb-6 rounded-xl shadow-sm"/);
});

test("selected boards support operational filters and date ranges", () => {
  assert.match(board, /ค้นหาชื่องาน รายละเอียด หรือเลข Ticket/);
  assert.match(board, /boardPriority/);
  assert.match(board, /boardAssignee/);
  assert.match(board, /overdueOnly/);
  assert.match(board, /dateRangePresets/);
  assert.match(board, /กลับหน้ารวม/);
});
