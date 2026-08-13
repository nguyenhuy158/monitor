# Odoo Monitor

Giám sát Cron Job Odoo và cảnh báo tức thì qua email.

## Commands
- Build: `pnpm run build`
- Dev (Backend + Frontend): `pnpm run dev`
- Dev Client: `pnpm run dev:client`
- Deploy: `pnpm run deploy`

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React.
- **Backend**: Hono, Cloudflare Workers.
- **Database**: Cloudflare D1.
- **Auth**: SSO (huyab auth) via JWT.
- **UI Components**: Tự xây dựng trong `client/src/ui` (không dùng thư viện ngoài để dễ copy).

## Project Structure
- `client/`: Mã nguồn frontend.
  - `src/ui/`: Bộ UI Kit dùng chung.
  - `src/App.tsx`: Logic chính và giao diện dashboard.
- `server/`: Mã nguồn backend.
  - `src/index.ts`: API endpoints và logic Cron check.
  - `src/odoo.ts`: Logic kết nối và lấy dữ liệu từ Odoo XML-RPC.
- `schema.sql`: Cấu trúc database D1.

## Code Style & Conventions
- Sử dụng `pnpm` thay vì `npm` hoặc `yarn`.
- Ưu tiên sử dụng icon (Lucide) thay cho chữ trên UI mobile.
- UI components nằm trong `@ui` alias.
- Sử dụng hàm `cn` cho classnames.
- Auto-reload dữ liệu mỗi 30s trên dashboard.
- Sorting và Pagination (limit 5) cho danh sách Cron Jobs.
- Mobile-first design, tối ưu cho iPhone/Android.
