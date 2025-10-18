const { Pool } = require('@neondatabase/serverless');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initSchema() {
  // Namespace tables to avoid collisions with any existing schema
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nc_workbooks (
      id TEXT PRIMARY KEY,
      title TEXT,
      meta JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      modified_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nc_sheets (
      id TEXT PRIMARY KEY,
      workbook_id TEXT REFERENCES nc_workbooks(id) ON DELETE CASCADE,
      name TEXT,
      row_count INT,
      col_count INT,
      visible BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nc_cells (
      sheet_id TEXT REFERENCES nc_sheets(id) ON DELETE CASCADE,
      row INT NOT NULL,
      col INT NOT NULL,
      address TEXT,
      data_type TEXT,
      raw TEXT,
      formula TEXT,
      computed JSONB,
      style JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (sheet_id, row, col)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nc_cells_sheet_row_col ON nc_cells(sheet_id, row, col)
  `);
}

module.exports = { pool, initSchema };