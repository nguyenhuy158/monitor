-- Tables cho project Monitor dùng chung DB D1
-- Prefix: monitor_

CREATE TABLE IF NOT EXISTS monitor_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    name TEXT NOT NULL, -- Tên gợi nhớ cho instance Odoo này
    url TEXT NOT NULL,
    db TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    env TEXT NOT NULL DEFAULT 'prod', -- dev | preprod | prod
    alert_enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS monitor_user_settings (
    user_email TEXT PRIMARY KEY,
    alert_delay_minutes INTEGER NOT NULL DEFAULT 30,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_monitor_configs_user ON monitor_configs(user_email);
