# ProjectHub Frontend

React + Vite + Ant Design + Tailwind CSS

## เริ่มใช้งาน

```powershell
npm install
npm run dev
```

เปิด http://localhost:5173

Backend ต้องทำงานที่ http://localhost:4000

## Stack

- React 19 + Vite
- Axios สำหรับเรียก API
- Ant Design สำหรับ UI components
- Tailwind CSS สำหรับ layout และ spacing
- Socket.IO Client สำหรับแจ้งเตือน real-time

## โครงสร้าง Source

- `src/app` Root component และ routes
- `src/pages` หน้าจอหลักแต่ละหน้า
- `src/components` Components ที่นำกลับมาใช้ได้
- `src/layouts` Sidebar, Topbar และ Layout
- `src/services` Axios API client
- `src/hooks` Custom React hooks
- `src/constants` ค่าคงที่และเมนูของระบบ
