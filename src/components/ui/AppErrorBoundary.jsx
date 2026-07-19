import { Component } from "react";
import { Button, Result } from "antd";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("UI render failed", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <Result
            status="error"
            title="หน้านี้เกิดข้อผิดพลาด"
            subTitle="ข้อมูลของคุณยังอยู่ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง"
            extra={(
              <Button type="primary" onClick={() => window.location.reload()}>
                โหลดหน้าใหม่
              </Button>
            )}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
