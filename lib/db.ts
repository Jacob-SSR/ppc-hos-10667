import mysql from "mysql2/promise";

const requiredEnv = [
  "DB_HOST",
  "DB_HOST2",
  "DB_PORT",
  "DB_USER",
  "DB_PASS",
  "DB_NAME",
  "JWT_SECRET",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: "tis620",
});

export const db2 = mysql.createPool({
  host: process.env.DB_HOST2,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: "tis620",
});
