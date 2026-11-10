export function parsePasswordReset(value: unknown): { username: string; newPassword: string } {
  if (!value || typeof value !== "object") throw new Error("คำขอไม่ถูกต้อง");
  const { username, newPassword } = value as Record<string, unknown>;
  if (typeof username !== "string" || !username.trim() || username.length > 255) {
    throw new Error("กรุณาเลือกบัญชีผู้ใช้");
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new Error("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
  }
  // Login trims passwords; reject values that could never be used as entered.
  if (newPassword !== newPassword.trim()) throw new Error("รหัสผ่านต้องไม่มีช่องว่างที่ต้นหรือท้าย");
  if (Buffer.byteLength(newPassword, "utf8") > 72 || newPassword.includes("\0")) {
    throw new Error("รหัสผ่านยาวเกิน 72 ไบต์ หรือมีอักขระที่ไม่รองรับ");
  }
  return { username, newPassword };
}

export const PASSWORD_RESET_AUDIT_DDL = `CREATE TABLE IF NOT EXISTS ppchos.password_reset_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_username VARCHAR(255) NOT NULL,
  target_username VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX target_created (target_username, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;
