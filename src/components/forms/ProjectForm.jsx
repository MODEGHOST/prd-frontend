import { useEffect, useState } from "react";
import { Button, Collapse, Form, Input, Select } from "antd";
import { AppRangePicker } from "../ui/AppDatePicker";
import { toApiDate } from "../../utils/datetime";
import {
  DESCRIPTION_SECTIONS,
  PRD_SECTIONS,
  parseDescription,
  parsePrd,
} from "../../utils/projectBrief";
import { usersApi } from "../../services/api";

const CONTEXT_PANEL = "context";
const PRD_PANEL = "prd";
const DESCRIPTION_FIELD_KEYS = DESCRIPTION_SECTIONS.map((section) => section.key);
const PRD_FIELD_KEYS = PRD_SECTIONS.map((section) => section.key);

function buildFormInitialValues(initialValues = {}) {
  const {
    name,
    code,
    range,
    ownerId,
    memberIds,
    description,
    prd,
    objective,
    problem,
    expectedOutcome,
    extraDetails,
    mainRequirements,
    businessRules,
    ...rest
  } = initialValues;

  const hasStructuredDescription =
    objective !== undefined ||
    problem !== undefined ||
    expectedOutcome !== undefined ||
    extraDetails !== undefined;
  const hasStructuredPrd =
    mainRequirements !== undefined ||
    businessRules !== undefined;

  return {
    ...rest,
    name,
    code,
    range,
    ownerId,
    memberIds: memberIds || [],
    ...(hasStructuredDescription
      ? {
          objective: objective || "",
          problem: problem || "",
          expectedOutcome: expectedOutcome || "",
          extraDetails: extraDetails || "",
        }
      : parseDescription(description)),
    ...(hasStructuredPrd
      ? {
          mainRequirements: mainRequirements || "",
          businessRules: businessRules || "",
        }
      : parsePrd(prd)),
  };
}

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
  const [openPanels, setOpenPanels] = useState([CONTEXT_PANEL]);
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
  const selectedKeep = users
    .filter((user) => memberIds.map(Number).includes(Number(user.id)))
    .filter((user) => !currentUserId || Number(user.id) !== Number(currentUserId))
    .filter((user) => !ownerId || Number(user.id) !== Number(ownerId))
    .map(toOption);
  const mergedMemberOptions = [
    ...selectedKeep,
    ...memberOptions.filter((option) => !selectedKeep.some((item) => Number(item.value) === Number(option.value))),
  ];

  const expandPanelsForErrors = (errorFields = []) => {
    const next = new Set(openPanels);
    const names = errorFields.map((field) => field.name?.[0]).filter(Boolean);
    if (names.some((name) => DESCRIPTION_FIELD_KEYS.includes(name))) next.add(CONTEXT_PANEL);
    if (names.some((name) => PRD_FIELD_KEYS.includes(name))) next.add(PRD_PANEL);
    setOpenPanels([...next]);
  };

  const handleFinish = async (values) => {
    const nextOwnerId = values.ownerId;
    const nextMemberIds = Array.from(
      new Set([...(values.memberIds || []), nextOwnerId].filter(Boolean)),
    );

    try {
      await onSubmit({
        name: values.name,
        code: values.code,
        objective: values.objective,
        problem: values.problem,
        expectedOutcome: values.expectedOutcome,
        extraDetails: values.extraDetails,
        mainRequirements: values.mainRequirements,
        businessRules: values.businessRules,
        startDate: values.range?.[0] ? toApiDate(values.range[0]) : "",
        endDate: values.range?.[1] ? toApiDate(values.range[1]) : "",
        ownerId: nextOwnerId,
        memberIds: nextMemberIds,
      });
      form.resetFields();
      setOpenPanels([CONTEXT_PANEL]);
    } catch {
      // keep form values when submit is rejected
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      className="md:[&_.ant-form-item]:mb-3"
      initialValues={buildFormInitialValues(initialValues)}
      onFinish={handleFinish}
      onFinishFailed={({ errorFields }) => expandPanelsForErrors(errorFields)}
    >
      <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
        <Form.Item name="name" label="ชื่อโครงการ" rules={[{ required: true, message: "กรุณากรอกชื่อโครงการ" }]}>
          <Input placeholder="เช่น ระบบแจ้งปัญหาภายใน" />
        </Form.Item>
        <Form.Item name="code" label="รหัสโครงการ" rules={[{ required: true, message: "กรุณากรอกรหัสโครงการ" }]}>
          <Input placeholder="เช่น WEB-01" />
        </Form.Item>
      </div>

      <Collapse
        activeKey={openPanels}
        onChange={(keys) => setOpenPanels(Array.isArray(keys) ? keys : [keys])}
        className="mb-3 rounded-xl border border-slate-200 bg-slate-50/60 [&_.ant-collapse-header]:!items-center [&_.ant-collapse-content-box]:pt-2"
        items={[
          {
            key: CONTEXT_PANEL,
            label: <span className="font-semibold text-slate-800">บริบทโปรเจกต์</span>,
            children: (
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
                {DESCRIPTION_SECTIONS.map((section) => (
                  <Form.Item
                    key={section.key}
                    name={section.key}
                    label={section.label}
                    className={section.key === "extraDetails" ? "md:col-span-2" : undefined}
                    rules={
                      section.required
                        ? [{ required: true, message: `กรุณากรอก${section.label}` }]
                        : undefined
                    }
                  >
                    <Input.TextArea
                      rows={3}
                      className="md:!min-h-[88px]"
                      placeholder={
                        section.key === "objective"
                          ? "โปรเจกต์นี้ต้องการบรรลุอะไร"
                          : section.key === "problem"
                            ? "ปัญหาหรือข้อจำกัดเดิมที่ทำให้ต้องทำระบบนี้"
                            : section.key === "expectedOutcome"
                              ? "เมื่อสำเร็จจะได้อะไร / วัดผลอย่างไร"
                              : "ข้อมูลอื่นที่เกี่ยวข้องเพิ่มเติม"
                      }
                    />
                  </Form.Item>
                ))}
              </div>
            ),
          },
          {
            key: PRD_PANEL,
            label: <span className="font-semibold text-slate-800">Product Requirement (PRD)</span>,
            children: (
              <div className="grid grid-cols-1 gap-0">
                {PRD_SECTIONS.map((section) => (
                  <Form.Item
                    key={section.key}
                    name={section.key}
                    label={section.label}
                    rules={
                      section.required
                        ? [{ required: true, message: `กรุณากรอก${section.label}` }]
                        : undefined
                    }
                  >
                    <Input.TextArea
                      rows={4}
                      className="md:!min-h-[110px]"
                      placeholder={
                        section.key === "mainRequirements"
                          ? "สรุปฟีเจอร์และความต้องการหลักที่รับมา"
                          : "เช่น ต้องอนุมัติก่อนใช้งาน, สิทธิ์การเข้าถึง"
                      }
                    />
                  </Form.Item>
                ))}
              </div>
            ),
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
        <Form.Item name="range" label="ระยะเวลาโครงการ">
          <AppRangePicker className="w-full" />
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
      </div>
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
      <Button type="primary" htmlType="submit" block loading={loading} className="mt-1">
        {submitLabel}
      </Button>
    </Form>
  );
}
