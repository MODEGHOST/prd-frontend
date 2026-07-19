import { Tag } from "antd";
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS } from "../../constants";

export function StatusTag({ value }) {
  return <Tag color={STATUS_COLORS[value] || "default"}>{STATUS_LABELS[value] || value}</Tag>;
}

export function PriorityTag({ value }) {
  return <Tag color={PRIORITY_COLORS[value] || "default"}>{PRIORITY_LABELS[value] || value}</Tag>;
}
