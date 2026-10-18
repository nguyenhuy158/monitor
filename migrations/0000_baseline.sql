-- Baseline: the monitor_* schema as it runs in production on 2026-10-18.
-- IF NOT EXISTS makes it a no-op there; on a fresh local D1 it creates the schema.

CREATE TABLE IF NOT EXISTS monitor_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    name TEXT NOT NULL, -- Tên gợi nhớ cho instance Odoo này
    url TEXT NOT NULL,
    db TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    alert_enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
, env TEXT NOT NULL DEFAULT 'prod', sort_order INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS monitor_user_settings (
    user_email TEXT PRIMARY KEY,
    alert_delay_minutes INTEGER NOT NULL DEFAULT 30,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_monitor_configs_user ON monitor_configs(user_email);
