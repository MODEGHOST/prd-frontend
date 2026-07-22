import { Tag } from "antd";
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../../constants";

export function StatusTag({ value }) {
  return <Tag color={STATUS_COLORS[value] || "default"}>{STATUS_LABELS[value] || value}</Tag>;
}

export function PriorityTag({ value, labeled = false, className }) {
  const text = PRIORITY_LABELS[value] || value;
  return (
    <Tag color={PRIORITY_COLORS[value] || "default"} className={className}>
      {labeled ? `สำคัญ · ${text}` : text}
    </Tag>
  );
}

export function DifficultyTag({ value, labeled = false, className }) {
  const text = DIFFICULTY_LABELS[value] || value;
  return (
    <Tag color={DIFFICULTY_COLORS[value] || "default"} className={className}>
      {labeled ? `ยาก · ${text}` : text}
    </Tag>
  );
}
