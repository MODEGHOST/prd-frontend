import { DatePicker } from "antd";
import { DATE_DISPLAY, DATETIME_DISPLAY } from "../../utils/datetime";

const PLACEHOLDER_DATE = "วว/ดด/ปปปป";
const PLACEHOLDER_RANGE = ["วันเริ่มต้น", "วันสิ้นสุด"];

/**
 * DatePicker มาตรฐานทั้งระบบ — รูปแบบ วัน/เดือน/ปี (พ.ศ.) ตัวเลข
 * ค่าที่เก็บ/ส่ง API ยังเป็นค.ศ. ผ่าน dayjs ตามเดิม
 */
export function AppDatePicker({
  showTime = false,
  format,
  className = "w-full",
  placeholder = PLACEHOLDER_DATE,
  ...props
}) {
  return (
    <DatePicker
      className={className}
      format={format || (showTime ? DATETIME_DISPLAY : DATE_DISPLAY)}
      showTime={showTime}
      placeholder={placeholder}
      {...props}
    />
  );
}

export function AppRangePicker({
  format = DATE_DISPLAY,
  className = "w-full",
  placeholder = PLACEHOLDER_RANGE,
  ...props
}) {
  return (
    <DatePicker.RangePicker
      className={className}
      format={format}
      placeholder={placeholder}
      {...props}
    />
  );
}
