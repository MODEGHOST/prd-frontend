import { Alert, Badge, Button, Empty, List, Modal, Tag, Typography } from "antd";
import {
  BellOutlined,
  CheckCircleOutlined,
  RightOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { PriorityTag, StatusTag } from "../ui/StatusTag";
import { formatDateTime } from "../../utils/datetime";

export function StartupWorkModal({
  open,
  summary,
  notifications,
  unreadTotal,
  requesterView,
  onClose,
  onOpenAction,
  onOpenNotification,
}) {
  const actionItems = summary?.actionItems || [];
  const unreadUpdates = notifications.filter((item) => !item.is_read).slice(0, 10);

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={(
        <Button type="primary" onClick={onClose}>
          เข้าใจแล้ว เริ่มทำงาน
        </Button>
      )}
      width={760}
      centered
      destroyOnHidden
    >
      <div className="mb-5 pr-6">
        <div className="mb-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
          <UnorderedListOutlined className="text-red-700" />
          สรุปงานที่ต้องติดตาม
        </div>
        <Typography.Text type="secondary">
          {requesterView
            ? "คำขอของคุณที่ยังดำเนินการไม่เสร็จ และรายการอัปเดตใหม่"
            : "งานที่ยังไม่เสร็จ งานที่ได้รับมอบหมาย และรายการอัปเดตใหม่"}
        </Typography.Text>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs text-slate-500">งานที่ต้องติดตาม</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{actionItems.length}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs text-amber-700">Ticket รอรับเรื่อง</div>
          <div className="mt-1 text-2xl font-semibold text-amber-800">
            {summary?.pendingIssueCount || 0}
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-xs text-red-700">อัปเดตที่ยังไม่ได้อ่าน</div>
          <div className="mt-1 text-2xl font-semibold text-red-800">{unreadTotal || 0}</div>
        </div>
      </div>

      {summary?.loadError ? (
        <Alert
          type="warning"
          showIcon
          message="โหลดรายการงานไม่สำเร็จ"
          description="คุณยังสามารถเข้าดูงานจากเมนูด้านซ้ายและตรวจสอบการแจ้งเตือนได้"
        />
      ) : !actionItems.length && !unreadTotal ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="ไม่มีงานค้างหรือรายการอัปเดตใหม่"
          description="คุณติดตามงานครบแล้ว"
        />
      ) : (
        <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <Typography.Text strong>
                {requesterView ? "คำขอที่ยังไม่เสร็จ" : "งานที่ต้องทำ"}
              </Typography.Text>
              <Badge count={actionItems.length} showZero color="#b91c1c" />
            </div>
            <List
              bordered
              dataSource={actionItems}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีงานค้าง" /> }}
              renderItem={(item) => (
                <List.Item
                  className="cursor-pointer transition hover:bg-slate-50"
                  onClick={() => onOpenAction(item)}
                  actions={[<RightOutlined key="open" className="text-slate-400" />]}
                >
                  <List.Item.Meta
                    title={(
                      <div className="flex flex-wrap items-center gap-2">
                        {item.item_type === "task" ? <Tag color="blue">Task</Tag> : <Tag>Ticket</Tag>}
                        <span>{item.ticket_no ? `${item.ticket_no} · ` : ""}{item.title}</span>
                      </div>
                    )}
                    description={(
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusTag value={item.status} />
                        <PriorityTag value={item.priority} />
                        <span className="text-xs text-slate-400">{item.project_name || "ทั่วไป"}</span>
                      </div>
                    )}
                  />
                </List.Item>
              )}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <Typography.Text strong>
                <BellOutlined className="mr-2 text-red-700" />
                อัปเดตใหม่
              </Typography.Text>
              <Badge count={unreadTotal || 0} showZero color="#b91c1c" />
            </div>
            <List
              bordered
              dataSource={unreadUpdates}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีอัปเดตใหม่" /> }}
              renderItem={(item) => (
                <List.Item
                  className="cursor-pointer transition hover:bg-red-50/50"
                  onClick={() => onOpenNotification(item)}
                  actions={[<RightOutlined key="open" className="text-slate-400" />]}
                >
                  <List.Item.Meta
                    title={item.title}
                    description={(
                      <div>
                        <div className="text-slate-600">{item.message}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.created_at ? formatDateTime(item.created_at, "") : ""}
                        </div>
                      </div>
                    )}
                  />
                </List.Item>
              )}
            />
          </section>
        </div>
      )}
    </Modal>
  );
}
