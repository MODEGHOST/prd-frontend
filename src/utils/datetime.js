import dayjs from "dayjs";
import buddhistEra from "dayjs/plugin/buddhistEra";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/th";

dayjs.extend(buddhistEra);
dayjs.extend(customParseFormat);
dayjs.locale("th");

/** แสดงผลวันที่ (ตัวเลข วัน/เดือน/ปี พ.ศ.) เช่น 19/07/2569 */
export const DATE_DISPLAY = "DD/MM/BBBB";

/** แสดงผลวันเวลา เช่น 19/07/2569 18:36 */
export const DATETIME_DISPLAY = "DD/MM/BBBB HH:mm";

/** ช่วงสั้นบนแถบ Gantt เช่น 19/07–17/08 */
export const DATE_SHORT = "DD/MM";

/** ส่งเข้า API / เก็บในฐานข้อมูล (ค.ศ. ISO) */
export const DATE_API = "YYYY-MM-DD";
export const DATETIME_API = "YYYY-MM-DD HH:mm:ss";

export function toDayjs(value) {
  if (!value) return null;
  if (dayjs.isDayjs(value)) return value;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

/** วันที่อย่างเดียว — ใช้กับระยะโปรเจกต์ / แผนงาน / due date */
export function formatDate(value, fallback = "-") {
  const date = toDayjs(value);
  return date ? date.format(DATE_DISPLAY) : fallback;
}

/** วัน + เวลา — ใช้กับประวัติ / แจ้งเตือน / แชท / คาดว่าจะเสร็จ */
export function formatDateTime(value, fallback = "-") {
  const date = toDayjs(value);
  return date ? date.format(DATETIME_DISPLAY) : fallback;
}

export function formatDateShort(value, fallback = "-") {
  const date = toDayjs(value);
  return date ? date.format(DATE_SHORT) : fallback;
}

export function formatDateRange(start, end, separator = " – ") {
  const from = formatDate(start, "");
  const to = formatDate(end, "");
  if (!from && !to) return "-";
  if (!from) return to;
  if (!to) return from;
  return `${from}${separator}${to}`;
}

export function toApiDate(value) {
  const date = toDayjs(value);
  return date ? date.format(DATE_API) : "";
}

export function toApiDateTime(value) {
  const date = toDayjs(value);
  return date ? date.format(DATETIME_API) : null;
}

export { dayjs };
