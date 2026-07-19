import dayjs from "dayjs";
import "dayjs/locale/th.js";

export function chatTimelineMeta(messages, index) {
  const current = messages[index];
  const previous = index > 0 ? messages[index - 1] : null;
  if (!previous) return { showSeparator: true, compactSender: false };
  const currentTime = dayjs(current?.created_at);
  const previousTime = dayjs(previous?.created_at);
  const validTimes = currentTime.isValid() && previousTime.isValid();
  const changedDay = validTimes && !currentTime.isSame(previousTime, "day");
  const gapMinutes = validTimes ? currentTime.diff(previousTime, "minute", true) : 10;
  const continuous = !changedDay && gapMinutes >= 0 && gapMinutes < 10;
  return {
    showSeparator: changedDay || gapMinutes >= 10 || gapMinutes < 0,
    compactSender: continuous
      && Number(current?.user_id) === Number(previous?.user_id),
  };
}

export function formatChatTimestamp(value, now = dayjs()) {
  const timestamp = dayjs(value);
  if (!timestamp.isValid()) return "";
  if (timestamp.isSame(now, "day")) return `วันนี้ ${timestamp.format("HH:mm")}`;
  if (timestamp.isSame(now.subtract(1, "day"), "day")) {
    return `เมื่อวาน ${timestamp.format("HH:mm")}`;
  }
  return timestamp.locale("th").format("D MMM YYYY HH:mm");
}
