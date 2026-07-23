import { DatePicker } from "antd";
import { DATE_DISPLAY, DATETIME_DISPLAY } from "../../utils/datetime";

const PLACEHOLDER_DATE = "วว/ดด/ปปปป";
const PLACEHOLDER_RANGE = ["วันเริ่มต้น", "วันสิ้นสุด"];
const PICKER_POPUP_CLASS = "app-picker-dropdown";

function mergePickerClassNames(classNames) {
  const popup = classNames?.popup;
  const popupRoot = typeof popup === "string"
    ? popup
    : popup?.root;
  return {
    ...classNames,
    popup: {
      ...(typeof popup === "object" ? popup : {}),
      root: [PICKER_POPUP_CLASS, popupRoot].filter(Boolean).join(" "),
    },
  };
}

/**
 * DatePicker มาตรฐานทั้งระบบ — รูปแบบ วัน/เดือน/ปี (พ.ศ.) ตัวเลข
 * ค่าที่เก็บ/ส่ง API ยังเป็น ค.ศ. ผ่าน dayjs ตามเดิม
 *
 * บนมือถือ: ปิดแป้นพิมพ์ (inputReadOnly) + CSS `.app-picker-dropdown`
 * จัด layout ใน styles.css (จอ >640px ไม่ถูกแตะ)
 */
export function AppDatePicker({
  showTime = false,
  format,
  className = "w-full",
  placeholder = PLACEHOLDER_DATE,
  inputReadOnly = true,
  classNames,
  ...props
}) {
  return (
    <DatePicker
      className={className}
      format={format || (showTime ? DATETIME_DISPLAY : DATE_DISPLAY)}
      showTime={showTime}
      placeholder={placeholder}
      {...props}
      inputReadOnly={inputReadOnly}
      classNames={mergePickerClassNames(classNames)}
    />
  );
}

export function AppRangePicker({
  format = DATE_DISPLAY,
  className = "w-full",
  placeholder = PLACEHOLDER_RANGE,
  inputReadOnly = true,
  classNames,
  ...props
}) {
  return (
    <DatePicker.RangePicker
      className={className}
      format={format}
      placeholder={placeholder}
      {...props}
      inputReadOnly={inputReadOnly}
      classNames={mergePickerClassNames(classNames)}
    />
  );
}
