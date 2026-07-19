import { useEffect, useState } from "react";
import { Alert, Button, Card, Result, Spin, Typography, message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { invitationsApi } from "../services/api";

export function InviteAcceptPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invitationsApi.preview(token)
      .then(setInvitation)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    setLoading(true);
    try {
      await invitationsApi.accept(token);
      message.success("รับคำเชิญแล้ว");
      navigate("/", { replace: true });
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading && !invitation) {
    return <div className="flex min-h-screen items-center justify-center"><Spin size="large" /></div>;
  }
  if (error && !invitation) {
    return <Result status="error" title="ไม่สามารถใช้คำเชิญนี้ได้" subTitle={error} />;
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg">
        <Typography.Title level={3}>คำเชิญเข้าร่วมบริษัท</Typography.Title>
        <Typography.Paragraph>
          บัญชีของคุณได้รับเชิญเข้า <strong>{invitation.company_name}</strong>
          {" "}ด้วยอีเมล {invitation.email}
        </Typography.Paragraph>
        {error ? <Alert className="mb-4" type="error" message={error} showIcon /> : null}
        <Button type="primary" block loading={loading} onClick={accept}>
          ยืนยันรับคำเชิญ
        </Button>
      </Card>
    </div>
  );
}
