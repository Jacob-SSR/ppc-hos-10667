-- Run against the DB_HOST2 server when the app account cannot CREATE tables.
-- Additive migration: existing accounts retain their original users.role access.
CREATE TABLE IF NOT EXISTS ppchos.user_access (
  username VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  role_override VARCHAR(32) NULL,
  features_json TEXT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
