import { useState } from "react";
import { Button, Form, Input, Select, Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";

export function IssueForm({
  projects,
  onSubmit,
  loading,
  simple = false,
  initialValues,
  showAttachments = true,
  submitLabel = "ส่งเรื่อง",
}) {
  const [form] = Form.useForm();
  const [files, setFiles] = useState([]);

  const handleFinish = async (values) => {
    try {
      const accepted = await onSubmit({
        ...values,
        type: values.type || "support",
        priority: values.priority || "medium",
        projectId: values.projectId || "",
        files: files.map((item) => item.originFileObj || item),
      });
      if (accepted === false) return;
      form.resetFields();
      setFiles([]);
    } catch {
      // keep form values when submit is rejected
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        type: simple ? "support" : "bug",
        priority: "medium",
        ...initialValues,
      }}
      onFinish={handleFinish}
    >
      <Form.Item name="title" label="หัวข้อ" rules={[{ required: true, message: "กรุณากรอกหัวข้อ" }]}>
        <Input />
      </Form.Item>
      <div className={simple ? "" : "grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4"}>
        <Form.Item name="type" label="ประเภท" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "bug", label: "แจ้งบั๊ก" },
              { value: "feature", label: "เสนอฟีเจอร์" },
              { value: "support", label: "ขอความช่วยเหลือ" },
            ]}
          />
        </Form.Item>
        {!simple ? (
          <Form.Item name="priority" label="ความสำคัญ" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "low", label: "ต่ำ" },
                { value: "medium", label: "ปานกลาง" },
                { value: "high", label: "สูง" },
                { value: "urgent", label: "เร่งด่วน" },
              ]}
            />
          </Form.Item>
        ) : null}
      </div>
      <Form.Item name="projectId" label="โครงการ">
        <Select
          allowClear
          placeholder="ไม่ระบุ / เรื่องทั่วไป"
          options={projects.map((project) => ({
            value: project.id,
            label: `${project.code} · ${project.name}`,
          }))}
        />
      </Form.Item>
      <Form.Item name="systemComponent" label="ระบบ / Component ที่เกี่ยวข้อง">
        <Input maxLength={160} placeholder="เช่น Mobile App / Login" />
      </Form.Item>
      <Form.Item name="description" label="รายละเอียด" rules={[{ required: true, message: "กรุณากรอกรายละเอียด" }]}>
        <Input.TextArea
          rows={6}
          onPaste={(event) => {
            const pasted = [...(event.clipboardData?.files || [])]
              .filter((file) => file.type.startsWith("image/"));
            if (!pasted.length) return;
            setFiles((current) => [
              ...current,
              ...pasted.map((file) => ({
                uid: `${Date.now()}-${file.name}-${file.size}`,
                name: file.name || `pasted-image-${Date.now()}.png`,
                status: "done",
                originFileObj: file,
              })),
            ].slice(0, 15));
          }}
        />
      </Form.Item>
      {showAttachments ? (
        <Form.Item label="ไฟล์แนบ" extra="ลากไฟล์มาวาง หรือวางรูปจาก clipboard ในช่องรายละเอียด (สูงสุด 15 ไฟล์ · ไฟล์ละไม่เกิน 25MB)">
          <Upload.Dragger
            multiple
            fileList={files}
            beforeUpload={() => false}
            onChange={({ fileList }) => setFiles(fileList.slice(0, 15))}
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt"
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p>ลากไฟล์มาวางหรือคลิกเพื่อเลือก</p>
          </Upload.Dragger>
        </Form.Item>
      ) : null}
      <Button type="primary" htmlType="submit" block loading={loading}>
        {submitLabel}
      </Button>
    </Form>
  );
}
