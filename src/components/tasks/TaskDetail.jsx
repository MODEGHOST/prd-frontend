import { useEffect } from "react";
import { Button, Form, Input, Modal, Select, Space, Tag } from "antd";
import { AppDatePicker } from "../ui/AppDatePicker";
import { toApiDate, toDayjs } from "../../utils/datetime";
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  STATUS_LABELS,
} from "../../constants";

const priorityOptions = [
  { value: "low", label: "ต่ำ" },
  { value: "medium", label: "ปานกลาง" },
  { value: "high", label: "สูง" },
  { value: "urgent", label: "เร่งด่วน" },
];

const difficultyOptions = Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function TaskDetail({
  task,
  open,
  users,
  canEdit,
  canChangeAssignee,
  loading,
  onClose,
  onSave,
  readOnlyHint,
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!task || !open) return;
    form.setFieldsValue({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "medium",
      difficulty: task.difficulty || "medium",
      assigneeId: task.assignee_id || undefined,
      startDate: task.start_date ? toDayjs(task.start_date) : null,
      dueDate: task.due_date ? toDayjs(task.due_date) : null,
    });
  }, [form, open, task]);

  const save = async (values) => {
    await onSave({
      title: values.title,
      description: values.description,
      priority: values.priority,
      difficulty: values.difficulty,
      assigneeId: values.assigneeId || "",
      startDate: values.startDate ? toApiDate(values.startDate) : "",
      dueDate: values.dueDate ? toApiDate(values.dueDate) : "",
    });
  };

  return (
    <Modal
      title={
        <Space wrap>
          <span>รายละเอียดงาน</span>
          {task?.issue_id ? <Tag color="blue">เชื่อมกับ Ticket</Tag> : null}
          {task?.status ? <Tag>{STATUS_LABELS[task.status]}</Tag> : null}
        </Space>
      }
      open={open}
      centered
      width={680}
      onCancel={onClose}
      destroyOnHidden
      footer={
        canEdit
          ? [
              <Button key="cancel" onClick={onClose}>
                ยกเลิก
              </Button>,
              <Button key="save" type="primary" loading={loading} onClick={() => form.submit()}>
                บันทึก
              </Button>,
            ]
          : [
              <Button key="close" type="primary" onClick={onClose}>
                ปิด
              </Button>,
            ]
      }
    >
      <Form form={form} layout="vertical" disabled={!canEdit} onFinish={save}>
        <Form.Item
          name="title"
          label="ชื่องาน"
          rules={[{ required: true, message: "กรุณากรอกชื่องาน" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label="คำอธิบาย">
          <Input.TextArea rows={4} placeholder="รายละเอียดของงานที่ต้องดำเนินการ" />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item name="assigneeId" label="ผู้รับผิดชอบ">
            <Select
              allowClear
              showSearch
              disabled={!canEdit || !canChangeAssignee}
              optionFilterProp="label"
              placeholder="เลือกสมาชิกในโครงการ"
              options={(users || []).map((user) => ({
                value: user.id ?? user.user_id,
                label: user.name || user.user_name,
              }))}
            />
          </Form.Item>
          <Form.Item name="priority" label="ความสำคัญ">
            <Select options={priorityOptions} />
          </Form.Item>
          <Form.Item name="startDate" label="วันเริ่ม">
            <AppDatePicker />
          </Form.Item>
          <Form.Item
            name="dueDate"
            label="วันสิ้นสุด / กำหนดส่ง"
            dependencies={["startDate"]}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const start = getFieldValue("startDate");
                  if (!start || !value || !value.isBefore(start, "day")) return Promise.resolve();
                  return Promise.reject(new Error("วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่ม"));
                },
              }),
            ]}
          >
            <AppDatePicker />
          </Form.Item>
          <Form.Item name="difficulty" label="ความยาก">
            <Select
              options={difficultyOptions.map((option) => ({
                ...option,
                label: (
                  <Space size={6}>
                    <Tag color={DIFFICULTY_COLORS[option.value]}>{option.label}</Tag>
                  </Space>
                ),
              }))}
            />
          </Form.Item>
        </div>
        {!canEdit ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {readOnlyHint || "คุณเปิดดูรายละเอียดได้ แต่ไม่มีสิทธิ์แก้ไขงานนี้"}
          </div>
        ) : null}
      </Form>
    </Modal>
  );
}
