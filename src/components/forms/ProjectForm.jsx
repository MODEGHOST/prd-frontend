import { useEffect, useState } from "react";
import { Button, Form, Input, Select } from "antd";
import { AppRangePicker } from "../ui/AppDatePicker";
import { toApiDate } from "../../utils/datetime";
import { usersApi } from "../../services/api";

export function ProjectForm({
  onSubmit,
  loading,
  users: usersProp,
  currentUserId,
  initialValues,
  submitLabel = "บันทึกโครงการ",
}) {
  const [form] = Form.useForm();
  const [users, setUsers] = useState(usersProp ?? []);
  const ownerId = Form.useWatch("ownerId", form);
  const memberIds = Form.useWatch("memberIds", form) || [];

  useEffect(() => {
    if (usersProp !== undefined) {
      setUsers(usersProp);
      return undefined;
    }

    let active = true;
    usersApi
      .list({ role: "staff" })
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

  const toOption = (user) => ({
    value: user.id,
    label: `${user.name} (${user.role})`,
  });

  const ownerOptions = users.map(toOption);
  const memberOptions = users
    .filter((user) => {
      const id = Number(user.id);
      if (currentUserId && id === Number(currentUserId)) return false;
      if (ownerId && id === Number(ownerId)) return false;
      return true;
    })
    .map(toOption);
  // Keep already-selected members visible even if filtered out of searchable list logic
  const selectedKeep = users
    .filter((user) => memberIds.map(Number).includes(Number(user.id)))
    .filter((user) => !currentUserId || Number(user.id) !== Number(currentUserId))
    .filter((user) => !ownerId || Number(user.id) !== Number(ownerId))
    .map(toOption);
  const mergedMemberOptions = [
    ...selectedKeep,
    ...memberOptions.filter((option) => !selectedKeep.some((item) => Number(item.value) === Number(option.value))),
  ];

  const handleFinish = async (values) => {
    const ownerId = values.ownerId;
    const memberIds = Array.from(
      new Set([...(values.memberIds || []), ownerId].filter(Boolean)),
    );

    try {
      await onSubmit({
        name: values.name,
        code: values.code,
        description: values.description,
        prd: values.prd,
        startDate: values.range?.[0] ? toApiDate(values.range[0]) : "",
        endDate: values.range?.[1] ? toApiDate(values.range[1]) : "",
        ownerId,
        memberIds,
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
      initialValues={{
        memberIds: [],
        ...initialValues,
      }}
      onFinish={handleFinish}
    >
      <Form.Item name="name" label="ชื่อโครงการ" rules={[{ required: true, message: "กรุณากรอกชื่อโครงการ" }]}>
        <Input placeholder="เช่น ระบบแจ้งปัญหาภายใน" />
      </Form.Item>
      <Form.Item name="code" label="รหัสโครงการ" rules={[{ required: true, message: "กรุณากรอกรหัสโครงการ" }]}>
        <Input placeholder="เช่น WEB-01" />
      </Form.Item>
      <Form.Item name="description" label="รายละเอียด">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name="prd" label="Product Requirement (PRD)">
        <Input.TextArea rows={5} />
      </Form.Item>
      <Form.Item name="range" label="ระยะเวลาโครงการ">
        <AppRangePicker />
      </Form.Item>
      <Form.Item
        name="ownerId"
        label="เจ้าของหลัก (Main Owner)"
        rules={[{ required: true, message: "กรุณาเลือกเจ้าของหลัก" }]}
        extra="ผู้สร้างโครงการและเจ้าของหลักสามารถเป็นคนละคนได้"
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="พิมพ์ชื่อเพื่อค้นหาเจ้าของหลัก"
          options={ownerOptions}
          filterOption={(input, option) =>
            String(option?.label || "").toLowerCase().includes(input.trim().toLowerCase())
          }
        />
      </Form.Item>
      <Form.Item
        name="memberIds"
        label="สมาชิกทีม"
        extra="เจ้าของหลักจะถูกเพิ่มอัตโนมัติ และไม่แสดงชื่อของคุณในรายการเลือก"
      >
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="พิมพ์ชื่อเพื่อค้นหาสมาชิก"
          options={mergedMemberOptions}
          maxTagCount="responsive"
          filterOption={(input, option) =>
            String(option?.label || "").toLowerCase().includes(input.trim().toLowerCase())
          }
        />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>
        {submitLabel}
      </Button>
    </Form>
  );
}
