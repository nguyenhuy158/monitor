# Odoo Monitor (moni.huyab.click)

Ứng dụng giám sát các bản ghi `ir.cron` của Odoo.

## Tính năng
- Kiểm tra các cron đang active.
- Cảnh báo qua email (thông qua `mailer` worker) nếu cron bị trễ giờ thực thi (`nextcall < now`).
- UI Dashboard hiển thị danh sách cron realtime.
- Tích hợp SSO login.

## Cấu trúc
- `src/worker`: Cloudflare Worker (Hono) xử lý API và Cron Trigger.
- `src/web`: React App (Vite) giao diện dashboard.

## Cài đặt & Phát triển

### Worker
1. Điền thông tin Odoo vào `wrangler.jsonc` hoặc dùng secret.
2. Chạy dev: `npx wrangler dev`

### Web
1. `cd src/web`
2. `npm install`
3. `npm run dev`

## Deployment
- Frontend: Cloudflare Pages (deploy thư mục `src/web/dist`).
- Backend: Cloudflare Workers.
