-- Schema only. Personnel data must be imported privately; do not commit HR exports.
-- Run on the application's existing ppchos database using an authorized SQL account.
CREATE TABLE IF NOT EXISTS ppchos.staff_dental_roster (
  cid CHAR(13) NOT NULL PRIMARY KEY,
  staff_ordinal INT UNSIGNED NOT NULL,
  prefix VARCHAR(80) NOT NULL DEFAULT '',
  first_name VARCHAR(200) NOT NULL,
  last_name VARCHAR(200) NOT NULL,
  position_name VARCHAR(255) NOT NULL,
  unit_name VARCHAR(255) NOT NULL,
  department_name VARCHAR(255) NOT NULL,
  employment_status VARCHAR(80) NOT NULL,
  active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY active_order (active, staff_ordinal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
