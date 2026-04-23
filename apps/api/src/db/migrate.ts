import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { config } from "../config";

const MIGRATIONS_DIR = path.join(__dirname, "../../migrations");

export async function runMigrations(databaseUrl?: string): Promise<void> {
  const pool = new Pool({
    connectionString: databaseUrl || config.database.url,
  });

  try {
    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await pool.query(
        "SELECT id FROM _migrations WHERE filename = $1",
        [file],
      );

      if (rows.length > 0) {
        console.log(`[migrate] Skipping already applied: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] Applying: ${file}`);

      await pool.query("BEGIN");
      try {
        await pool.query(sql);
        await pool.query("INSERT INTO _migrations (filename) VALUES ($1)", [
          file,
        ]);
        await pool.query("COMMIT");
        console.log(`[migrate] Applied: ${file}`);
      } catch (err) {
        await pool.query("ROLLBACK");
        throw err;
      }
    }

    console.log("[migrate] All migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

// Allow running directly: ts-node src/db/migrate.ts
if (require.main === module) {
  runMigrations().catch((err) => {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  });
}
