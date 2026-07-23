import { Component } from "react";
import { Button, Result } from "antd";
import { isChunkLoadError } from "../../utils/lazyWithRetry";

const CHUNK_RELOAD_FLAG = "projecthub:chunk-reload";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, error };
  }

  componentDidCatch(error, info) {
    console.error("UI render failed", error, info);
    // One silent full reload for stale/missing chunks (e.g. after deploy).
    // Avoids a reload loop via sessionStorage flag.
    if (!isChunkLoadError(error)) return;
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
        sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
        return;
      }
      sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1");
      window.location.reload();
    } catch {
      // Ignore storage errors; fall through to the soft recovery UI.
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, error: null });
    }
  }

  handleRetry = () => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ failed: false, error: null });
  };

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <Result
            status="warning"
            title="ยังโหลดหน้านี้ไม่สำเร็จ"
            subTitle="ข้อมูลของคุณยังอยู่ ลองใหม่อีกครั้งได้เลย หรือโหลดหน้าใหม่ถ้ายังไม่หาย"
            extra={(
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="primary" onClick={this.handleRetry}>
                  ลองอีกครั้ง
                </Button>
                <Button onClick={() => window.location.reload()}>
                  โหลดหน้าใหม่
                </Button>
              </div>
            )}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
