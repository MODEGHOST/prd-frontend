import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Empty,
  Input,
  List,
  Modal,
  Typography,
} from "antd";
import {
  BellOutlined,
  MessageOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

function fallbackTarget(item) {
  if (item.target_url) return item.target_url;
  const text = `${item.title || ""} ${item.message || ""}`.toLowerCase();
  if (text.includes("ticket") || text.includes("issue")) return "/issues";
  if (text.includes("โครงการ") || text.includes("project")) return "/projects";
  if (text.includes("งาน") || text.includes("task")) return "/my-tasks";
  return "/";
}

function NotificationItem({ item, onClick }) {
  const isChat = item.type === "chat";
  return (
    <List.Item
      className={`cursor-pointer rounded-xl px-2.5 py-2 transition hover:bg-slate-50 ${
        !item.is_read ? "bg-red-50/80" : ""
      }`}
      onClick={() => onClick(item)}
    >
      <List.Item.Meta
        avatar={
          <Avatar
            icon={isChat ? <MessageOutlined /> : <BellOutlined />}
            className={isChat ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-700"}
          />
        }
        title={
          <div className="flex items-start justify-between gap-2">
            <span className={`line-clamp-1 text-sm ${!item.is_read ? "font-semibold" : "font-medium"}`}>
              {item.title}
            </span>
            {!item.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-600" /> : null}
          </div>
        }
        description={
          <div>
            {item.actor_name ? (
              <div className="line-clamp-1 text-xs font-medium text-slate-500">{item.actor_name}</div>
            ) : null}
            <div className="line-clamp-2 text-xs text-slate-500">{item.message}</div>
            <div className="mt-1 text-[11px] text-slate-400">
              {item.created_at ? dayjs(item.created_at).format("D MMM YYYY HH:mm") : ""}
            </div>
          </div>
        }
      />
    </List.Item>
  );
}

export function NotificationCenter({
  notifications,
  unreadTotal,
  onReadAll,
  onReadOne,
  onOpenChat,
  requesterView = false,
}) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const unread = Number(unreadTotal || 0);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("th");
    if (!keyword) return notifications;
    return notifications.filter((item) =>
      [item.actor_name, item.title, item.message]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("th").includes(keyword)),
    );
  }, [notifications, query]);

  const openItem = async (item) => {
    setDropdownOpen(false);
    setModalOpen(false);
    if (!item.is_read) await onReadOne(item.id);
    if (item.type === "chat" && item.entity_type && item.entity_id) {
      onOpenChat(item);
      return;
    }
    if (requesterView) {
      if (item.entity_type === "issue" && item.entity_id) {
        navigate(`/issues?issue=${item.entity_id}`);
      } else {
        navigate("/issues");
      }
      return;
    }
    navigate(fallbackTarget(item));
  };

  const dropdown = (
    <div className="w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <Typography.Text strong>การแจ้งเตือน</Typography.Text>
          <div className="text-xs text-slate-400">{unread ? `ยังไม่ได้อ่าน ${unread} รายการ` : "อ่านครบแล้ว"}</div>
        </div>
        <Button type="link" size="small" onClick={onReadAll} disabled={!unread}>
          อ่านทั้งหมด
        </Button>
      </div>
      <div className="max-h-[432px] overflow-y-auto pr-1">
        <List
          size="small"
          split={false}
          dataSource={notifications}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีการแจ้งเตือน" /> }}
          renderItem={(item) => <NotificationItem item={item} onClick={openItem} />}
        />
      </div>
      <Button
        type="text"
        block
        className="mt-2 border-t border-slate-100"
        onClick={() => {
          setDropdownOpen(false);
          setModalOpen(true);
        }}
      >
        ดูรายการล่าสุด
      </Button>
    </div>
  );

  return (
    <>
      <Dropdown
        trigger={["click"]}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        popupRender={() => dropdown}
      >
        <Badge count={unread} size="small" overflowCount={99}>
          <Button shape="circle" icon={<BellOutlined />} aria-label="เปิดการแจ้งเตือน" />
        </Badge>
      </Dropdown>

      <Modal
        title="การแจ้งเตือนล่าสุด"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={680}
        centered
        destroyOnHidden
      >
        <Input
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="ค้นหาจากชื่อคน หัวข้อ หรือข้อความ"
          className="mb-3"
        />
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <List
            split={false}
            dataSource={filtered}
            locale={{ emptyText: <Empty description="ไม่พบการแจ้งเตือนที่ค้นหา" /> }}
            renderItem={(item) => <NotificationItem item={item} onClick={openItem} />}
          />
        </div>
      </Modal>
    </>
  );
}
