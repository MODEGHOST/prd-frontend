import { useEffect, useState } from "react";
import { Button, Form, Input, Select } from "antd";
import { AppDatePicker } from "../ui/AppDatePicker";
import { toApiDate } from "../../utils/datetime";
import { usersApi } from "../../services/api";

export function TaskForm({ onSubmit, loading, users: usersProp }) {
  const [form] = Form.useForm();
  const [users, setUsers] = useState(usersProp ?? []);

  useEffect(() => {
    if (usersProp !== undefined) {
      setUsers(usersProp);
      return undefined;
    }

    let active = true;
    usersApi
      .list()
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch(() => {
        if (active) setUsers([]);
      });

    return () => {
      active = false;
    };
  }, [usersProp]);

  const handleFinish = async (values) => {
    try {
      await onSubmit({
        title: values.title,
        description: values.description,
        priority: values.priority,
        difficulty: values.difficulty,
        assigneeId: values.assigneeId || "",
        startDate: values.startDate ? toApiDate(values.startDate) : "",
        dueDate: values.dueDate ? toApiDate(values.dueDate) : "",
      });
      form.resetFields();
    } catch {
      // keep form values when submit is rejected
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ priority: "medium", difficulty: "medium" }}
      onFinish={handleFinish}
    >
      <Form.Item name="title" label="ชื่องาน" rules={[{ required: true, message: "กรุณากรอกชื่องาน" }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label="รายละเอียด">
        <Input.TextArea rows={3} />
      </Form.Item>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
        <Form.Item name="assigneeId" label="ผู้รับผิดชอบ">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={users.length ? "พิมพ์ชื่อเพื่อค้นหา" : "ยังไม่มีสมาชิกเจ้าหน้าที่ในโครงการ"}
            notFoundContent="ไม่พบสมาชิกในโครงการ"
            options={users.map((user) => ({
              value: user.id ?? user.user_id,
              label: user.name || user.user_name,
            }))}
            filterOption={(input, option) =>
              String(option?.label || "").toLowerCase().includes(input.trim().toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="priority" label="ความสำคัญ">
          <Select
            options={[
              { value: "low", label: "ต่ำ" },
              { value: "medium", label: "ปานกลาง" },
              { value: "high", label: "สูง" },
              { value: "urgent", label: "เร่งด่วน" },
            ]}
          />
        </Form.Item>
        <Form.Item name="difficulty" label="ความยาก">
          <Select
            options={[
              { value: "easy", label: "ง่าย" },
              { value: "medium", label: "ปานกลาง" },
              { value: "hard", label: "ยาก" },
            ]}
          />
        </Form.Item>
        <Form.Item name="startDate" label="วันเริ่ม">
          <AppDatePicker />
        </Form.Item>
        <Form.Item name="dueDate" label="กำหนดส่ง">
          <AppDatePicker />
        </Form.Item>
      </div>
      <Button type="primary" htmlType="submit" block loading={loading}>
        เพิ่มลงกระดาน
      </Button>
    </Form>
  );
}
