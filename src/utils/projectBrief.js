export const DESCRIPTION_SECTIONS = [
  { key: "objective", label: "วัตถุประสงค์", required: true, dbKey: "objective" },
  { key: "problem", label: "ปัญหาเดิม", required: true, dbKey: "problem" },
  { key: "expectedOutcome", label: "ผลลัพธ์ที่คาดหวัง", required: true, dbKey: "expected_outcome" },
  { key: "extraDetails", label: "รายละเอียดเพิ่มเติม", required: false, dbKey: "extra_details" },
];

export const PRD_SECTIONS = [
  { key: "mainRequirements", label: "ฟีเจอร์/ความต้องการหลัก", required: true, dbKey: "main_requirements" },
  { key: "businessRules", label: "เงื่อนไข/กฎทางธุรกิจ", required: false, dbKey: "business_rules" },
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function composeSections(sections, values = {}) {
  return sections
    .map(({ key, label }) => {
      const text = String(values[key] || "").trim();
      if (!text) return null;
      return `${label}:\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function parseSections(sections, text, fallbackKey) {
  const result = Object.fromEntries(sections.map((section) => [section.key, ""]));
  const raw = String(text || "").trim();
  if (!raw) return result;

  const labelToKey = Object.fromEntries(sections.map((section) => [section.label, section.key]));
  const labelPattern = sections.map((section) => escapeRegex(section.label)).join("|");
  const splitter = new RegExp(`(?:^|\\n)(${labelPattern}):\\s*`, "g");
  const matches = [...raw.matchAll(splitter)];

  if (!matches.length) {
    const key = fallbackKey || sections.at(-1)?.key;
    if (key) result[key] = raw;
    return result;
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = labelToKey[match[1]];
    if (!key) continue;
    const contentStart = match.index + match[0].length;
    const contentEnd = index + 1 < matches.length ? matches[index + 1].index : raw.length;
    result[key] = raw.slice(contentStart, contentEnd).trim();
  }

  return result;
}

export function composeDescription(values) {
  return composeSections(DESCRIPTION_SECTIONS, values);
}

export function composePrd(values) {
  return composeSections(PRD_SECTIONS, values);
}

export function parseDescription(text) {
  return parseSections(DESCRIPTION_SECTIONS, text, "extraDetails");
}

export function parsePrd(text) {
  return parseSections(PRD_SECTIONS, text, "mainRequirements");
}

export function projectBriefValues(project = {}) {
  const hasStructured = DESCRIPTION_SECTIONS.concat(PRD_SECTIONS).some(
    (section) => project[section.dbKey] || project[section.key],
  );

  if (hasStructured) {
    return Object.fromEntries(
      DESCRIPTION_SECTIONS.concat(PRD_SECTIONS).map((section) => [
        section.key,
        project[section.key] || project[section.dbKey] || "",
      ]),
    );
  }

  return {
    ...parseDescription(project.description),
    ...parsePrd(project.prd),
  };
}

export function summarizeProjectBrief(project, maxLength = 120) {
  const values = typeof project === "string"
    ? parseDescription(project)
    : projectBriefValues(project || {});
  const summary =
    values.objective ||
    values.problem ||
    values.expectedOutcome ||
    values.extraDetails ||
    (typeof project === "string" ? project : project?.description) ||
    "";
  const text = String(summary || "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

/** @deprecated use summarizeProjectBrief */
export function summarizeDescription(text, maxLength = 120) {
  return summarizeProjectBrief(text, maxLength);
}

export function sectionEntries(sections, source, { hideEmpty = true } = {}) {
  const values = typeof source === "string"
    ? parseSections(sections, source)
    : projectBriefValues(source || {});

  return sections
    .map((section) => ({
      key: section.key,
      label: section.label,
      value: values[section.key] || "",
    }))
    .filter((entry) => !hideEmpty || entry.value);
}
