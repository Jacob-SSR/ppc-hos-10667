-- Run on DB_HOST2 if the app account cannot CREATE tables.
CREATE TABLE IF NOT EXISTS ppchos.password_reset_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_username VARCHAR(255) NOT NULL,
  target_username VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX target_created (target_username, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
