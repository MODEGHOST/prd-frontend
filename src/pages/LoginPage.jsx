import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import {
  ApartmentOutlined,
  IdcardOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { authApi, invitationsApi } from "../services/api";
import {
  getPasswordStatus,
  passwordValidationError,
} from "../utils/passwordPolicy";

const securePasswordRules = [
  { required: true, message: "กรุณาตั้งรหัสผ่าน" },
  {
    validator(_, value) {
      if (!value) return Promise.resolve();
      const error = passwordValidationError(value);
      return error
        ? Promise.reject(new Error(error))
        : Promise.resolve();
    },
  },
];

function PasswordStrengthInput({ value = "", onChange, ...inputProps }) {
  const { checks, percent } = getPasswordStatus(value);
  const color = percent < 50 ? "#ef4444" : percent < 80 ? "#f59e0b" : "#16a34a";
  const label = percent < 50 ? "ควรปรับปรุง" : percent < 80 ? "ปานกลาง" : "แข็งแรง";

  return (
    <div>
      <Input.Password
        {...inputProps}
        value={value}
        onChange={onChange}
        prefix={<LockOutlined />}
        size="large"
        autoComplete="new-password"
      />
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">ความปลอดภัยของรหัสผ่าน</span>
          <span style={{ color }} className="font-semibold">
            {percent}% · {label}
          </span>
        </div>
        <Progress
          percent={percent}
          showInfo={false}
          strokeColor={color}
          trailColor="#e2e8f0"
          size="small"
        />
        <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {checks.map((check) => (
            <span
              key={check.key}
              className={check.met ? "text-green-700" : value ? "text-red-600" : "text-slate-500"}
            >
              {check.met ? "✓" : "○"} {check.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LoginPage({ onLogin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [forgotForm] = Form.useForm();
  const [searchParams, setSearchParams] = useSearchParams();
  const linkToken = searchParams.get("token");
  const resetToken = location.pathname === "/reset-password" ? linkToken : null;
  const verifyToken = location.pathname === "/verify-email" ? linkToken : null;
  const inviteToken = location.pathname === "/invite" ? linkToken : null;
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [companies, setCompanies] = useState([]);
  const [invitation, setInvitation] = useState(null);

  const registrationCompanies = useMemo(
    () => companies.map((company) => ({
      value: company.id,
      label: company.parent_name
        ? `${company.name} · ${company.parent_name}`
        : company.name,
    })),
    [companies],
  );

  useEffect(() => {
    if (!inviteToken) return;
    invitationsApi.preview(inviteToken)
      .then((data) => {
        setInvitation(data);
        setCompanies([{ id: data.company_id, name: data.company_name }]);
        setMode("register");
      })
      .catch((err) => setError(err.message));
  }, [inviteToken]);

  useEffect(() => {
    if (mode !== "register") return;
    if (invitation) return;
    authApi.companies()
      .then((data) => setCompanies(Array.isArray(data) ? data : data.items || []))
      .catch((err) => setError(err.message));
  }, [mode, invitation]);

  useEffect(() => {
    if (!verifyToken) return;
    setLoading(true);
    authApi.verifyEmail(verifyToken)
      .then((data) => {
        setSuccess(data.message || "ยืนยันอีเมลแล้ว กรุณารอผู้ดูแลบริษัทอนุมัติ");
        setSearchParams({});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [verifyToken, setSearchParams]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
  };

  const login = async (values) => {
    setLoading(true);
    setError("");
    try {
      const data = await authApi.login(values);
      onLogin(data);
      navigate("/", { replace: true });
      message.success("เข้าสู่ระบบสำเร็จ");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const register = async (values) => {
    setLoading(true);
    setError("");
    try {
      const data = await authApi.register({
        ...values,
        inviteToken: inviteToken || undefined,
      });
      setSuccess(data.message || "สมัครสมาชิกแล้ว กรุณารอผู้ดูแลอนุมัติ");
      setMode("login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async ({ email }) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await authApi.forgotPassword(email);
      setSuccess(data.message || "หากพบอีเมล ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmForgotPassword = ({ email }) => {
    Modal.confirm({
      centered: true,
      title: "ยืนยันการส่งลิงก์รีเซ็ตรหัสผ่าน",
      content: (
        <div className="mt-4 space-y-3">
          <div>ระบบจะส่งลิงก์ไปยังอีเมลที่คุณกรอก:</div>
          <Alert type="info" showIcon message={email} />
        </div>
      ),
      okText: "ส่งลิงก์",
      cancelText: "ยกเลิก",
      onOk: () => forgotPassword({ email }),
    });
  };

  const resetPassword = async ({ password }) => {
    setLoading(true);
    setError("");
    try {
      const data = await authApi.resetPassword(resetToken, password);
      setSuccess(data.message || "ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ");
      setSearchParams({});
      setMode("login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const title = {
    login: "เข้าสู่ระบบ",
    register: "สมัครสมาชิก",
    forgot: "ลืมรหัสผ่าน",
    reset: "ตั้งรหัสผ่านใหม่",
  }[mode];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-32 -right-28 h-96 w-96 rounded-full bg-red-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }} />

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl shadow-black/20">
            <img
              src="/lee-fibreboard-logo.png"
              alt="บริษัท ลี้ไฟเบอร์บอร์ด จำกัด"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="text-xl font-bold">บริษัท ลี้ไฟเบอร์บอร์ด จำกัด</div>
            <div className="mt-1 text-xs tracking-[0.12em] text-slate-400">
              LEE FIBREBOARD CO., LTD.
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3.5 py-1.5 text-xs font-medium tracking-[0.14em] text-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            COMPANY INTERNAL SYSTEM
          </div>
          <p className="mb-2 text-sm font-medium tracking-[0.18em] text-red-300">
            LEE FIBREBOARD DIGITAL WORKSPACE
          </p>
          <h1 className="mb-5 text-5xl leading-[1.15] font-bold tracking-tight">
            Internal Project
            <br />
            <span className="text-red-400">&amp;</span> Management System
          </h1>
          <p className="max-w-lg text-base leading-8 text-slate-300">
            ระบบบริหารโครงการและติดตามงานภายใน ศูนย์กลางสำหรับติดตาม Issue มอบหมายงาน
            และประสานงานร่วมกันอย่างเป็นระบบสำหรับบุคลากรภายในบริษัท
          </p>

          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["Project", "บริหารโครงการ"],
              ["Issue", "ติดตามปัญหา"],
              ["Real-time", "อัปเดตทันที"],
            ].map(([heading, detail]) => (
              <div key={heading} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
                <div className="font-semibold text-white">{heading}</div>
                <div className="mt-1 text-xs text-slate-400">{detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
          <span>สำหรับบุคลากรของบริษัทเท่านั้น</span>
          <span>SECURE INTERNAL ACCESS</span>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#f3f5f9] p-6">
        <Card className="w-full max-w-md rounded-2xl shadow-sm">
          <div className="mb-6">
            <Typography.Text type="secondary">
              Internal Project &amp; Management System
            </Typography.Text>
            <Typography.Title level={2} className="!mt-1 !mb-1">
              {title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-0">
              {mode === "register"
                ? "เลือกบริษัทและส่งคำขอเข้าร่วม ผู้ดูแลบริษัทจะเป็นผู้อนุมัติ"
                : "ใช้ชื่อผู้ใช้และรหัสผ่านของคุณเพื่อเข้าใช้งาน"}
            </Typography.Paragraph>
          </div>

          {error ? <Alert className="mb-4" type="error" message={error} showIcon /> : null}
          {success ? <Alert className="mb-4" type="success" message={success} showIcon /> : null}

          {mode === "login" ? (
            <Form
              key={invitation?.email || "login"}
              name="ipms-login"
              layout="vertical"
              onFinish={login}
              autoComplete="on"
            >
              <Form.Item
                name="username"
                label="ชื่อผู้ใช้"
                rules={[{ required: true, message: "กรุณากรอกชื่อผู้ใช้" }]}
              >
                <Input
                  id="login-username"
                  name="username"
                  prefix={<UserOutlined />}
                  size="large"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Form.Item>
              <Form.Item
                name="password"
                label="รหัสผ่าน"
                rules={[{ required: true, message: "กรุณากรอกรหัสผ่าน" }]}
              >
                <Input.Password
                  id="login-password"
                  name="password"
                  prefix={<LockOutlined />}
                  size="large"
                  autoComplete="current-password"
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                เข้าสู่ระบบ
              </Button>
              <div className="mt-4 flex justify-between">
                <Button type="link" className="!px-0" onClick={() => changeMode("register")}>
                  สมัครสมาชิก
                </Button>
                <Button type="link" className="!px-0" onClick={() => changeMode("forgot")}>
                  ลืมรหัสผ่าน?
                </Button>
              </div>
            </Form>
          ) : null}

          {mode === "register" ? (
            <Form
              key={invitation?.email || "public-registration"}
              layout="vertical"
              onFinish={register}
              initialValues={invitation ? {
                companyId: invitation.company_id,
                email: invitation.email,
              } : undefined}
            >
              <Form.Item
                name="companyId"
                label="บริษัท"
                rules={[{ required: true, message: "กรุณาเลือกบริษัท" }]}
                className="!mb-3"
              >
                <Select
                  showSearch
                  size="large"
                  placeholder="เลือกบริษัทที่คุณทำงาน"
                  optionFilterProp="label"
                  options={registrationCompanies}
                  suffixIcon={<ApartmentOutlined />}
                  disabled={Boolean(invitation)}
                />
              </Form.Item>

              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <Form.Item
                  name="employeeCode"
                  label="รหัสพนักงาน"
                  normalize={(value) => String(value || "").replace(/\D/g, "").slice(0, 8)}
                  rules={[
                    { required: true, message: "กรุณากรอกรหัสพนักงาน" },
                    { pattern: /^\d{8}$/, message: "รหัสพนักงานต้องเป็นตัวเลข 8 หลัก" },
                  ]}
                  className="!mb-3"
                >
                  <Input
                    prefix={<IdcardOutlined />}
                    size="large"
                    maxLength={8}
                    inputMode="numeric"
                    placeholder="ตัวเลข 8 หลัก"
                  />
                </Form.Item>
                <Form.Item
                  name="telegramId"
                  label="Telegram ID"
                  rules={[
                    {
                      validator(_, value) {
                        if (!value) return Promise.resolve();
                        if (!/^@?[a-zA-Z0-9_]{3,64}$/.test(value)) {
                          return Promise.reject(new Error("รูปแบบไม่ถูกต้อง"));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                  className="!mb-3"
                  extra="ไม่บังคับ"
                >
                  <Input size="large" placeholder="@username หรือ ID" maxLength={64} />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <Form.Item
                  name="firstName"
                  label="ชื่อ"
                  rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
                  className="!mb-3"
                >
                  <Input prefix={<UserOutlined />} size="large" maxLength={120} />
                </Form.Item>
                <Form.Item
                  name="lastName"
                  label="นามสกุล"
                  rules={[{ required: true, message: "กรุณากรอกนามสกุล" }]}
                  className="!mb-3"
                >
                  <Input size="large" maxLength={120} />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <Form.Item
                  name="username"
                  label="ชื่อผู้ใช้"
                  rules={[
                    { required: true, message: "กรุณากรอกชื่อผู้ใช้" },
                    {
                      pattern: /^[a-zA-Z0-9._-]{3,50}$/,
                      message: "3-50 ตัว (a-z, 0-9, . _ -)",
                    },
                  ]}
                  className="!mb-3"
                  extra="ใช้เข้าสู่ระบบ"
                >
                  <Input
                    prefix={<UserOutlined />}
                    size="large"
                    autoComplete="username"
                    maxLength={50}
                  />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="อีเมล"
                  rules={[
                    { required: true, message: "กรุณากรอกอีเมล" },
                    { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
                  ]}
                  className="!mb-3"
                  extra="ยืนยันบัญชี / รีเซ็ตรหัสผ่าน"
                >
                  <Input
                    prefix={<MailOutlined />}
                    size="large"
                    autoComplete="email"
                    disabled={Boolean(invitation)}
                  />
                </Form.Item>
              </div>

              <Form.Item
                name="password"
                label="ตั้งรหัสผ่าน"
                rules={securePasswordRules}
                className="!mb-3"
              >
                <PasswordStrengthInput />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                ส่งคำขอสมัครสมาชิก
              </Button>
              <Button type="link" block onClick={() => changeMode("login")}>
                กลับไปเข้าสู่ระบบ
              </Button>
            </Form>
          ) : null}

          {mode === "forgot" ? (
            <Form form={forgotForm} layout="vertical" onFinish={confirmForgotPassword}>
              <Form.Item
                name="email"
                label="อีเมลที่ใช้สมัคร"
                rules={[
                  { required: true, message: "กรุณากรอกอีเมล" },
                  { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
                ]}
              >
                <Input prefix={<MailOutlined />} size="large" autoComplete="email" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                ส่งลิงก์รีเซ็ตรหัสผ่าน
              </Button>
              <Button type="link" block onClick={() => changeMode("login")}>
                กลับไปเข้าสู่ระบบ
              </Button>
            </Form>
          ) : null}

          {mode === "reset" ? (
            <Form layout="vertical" onFinish={resetPassword}>
              <Form.Item
                name="password"
                label="รหัสผ่านใหม่"
                rules={securePasswordRules}
              >
                <PasswordStrengthInput />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="ยืนยันรหัสผ่านใหม่"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "กรุณายืนยันรหัสผ่าน" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return !value || getFieldValue("password") === value
                        ? Promise.resolve()
                        : Promise.reject(new Error("รหัสผ่านไม่ตรงกัน"));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} size="large" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                บันทึกรหัสผ่านใหม่
              </Button>
            </Form>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
