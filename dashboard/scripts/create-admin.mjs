#!/usr/bin/env node
// Interactive admin bootstrap.
//   docker compose run --rm dashboard npm run create-admin
//
// Prompts for email + password, hashes the password with Argon2id, and inserts
// the row into _dashboard.admins. The plaintext password never leaves memory.

import readline from "node:readline";
import { Writable } from "node:stream";
import pg from "pg";
import { hash } from "@node-rs/argon2";

const { Pool } = pg;

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const muted = new Writable({
      write(chunk, _enc, cb) {
        if (!hidden) process.stdout.write(chunk);
        cb();
      },
    });
    const rl = readline.createInterface({
      input: process.stdin,
      output: muted,
      terminal: true,
    });
    process.stdout.write(question);
    rl.question("", (answer) => {
      if (hidden) process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const email = (await ask("Email: ")).trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Invalid email");
    process.exit(1);
  }

  const password = await ask("Password: ", { hidden: true });
  if (password.length < 12) {
    console.error("Password must be at least 12 characters");
    process.exit(1);
  }
  const confirm = await ask("Confirm:  ", { hidden: true });
  if (password !== confirm) {
    console.error("Passwords do not match");
    process.exit(1);
  }

  const password_hash = await hash(password);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: existing } = await pool.query(
      "SELECT id FROM _dashboard.users WHERE email = $1",
      [email],
    );
    if (existing.length > 0) {
      await pool.query(
        `UPDATE _dashboard.users
            SET password_hash = $2,
                role          = 'admin',
                disabled_at   = NULL,
                updated_at    = now()
          WHERE email = $1`,
        [email, password_hash],
      );
      console.log(`Updated password for ${email}`);
    } else {
      await pool.query(
        `INSERT INTO _dashboard.users (email, password_hash, role)
         VALUES ($1, $2, 'admin')`,
        [email, password_hash],
      );
      console.log(`Created admin ${email}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
