const express = require('express');
const { pool, initSchema } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize schema on startup
initSchema()
  .then(() => console.log('Database schema ready'))
  .catch(err => {
    console.error('Schema initialization failed:', err);
    process.exit(1);
  });

// Root route
app.get('/', (req, res) => {
  res.send('Backend server is running');
});

// Test database connection route
app.get('/test-db', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW()');
    res.json({ time: rows[0].now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed demo data for quick verification
app.post('/seed-demo', async (req, res) => {
  try {
    const wbId = 'demo-wb';
    const sheetId = 'demo-sheet-1';

    await pool.query(
      `INSERT INTO nc_workbooks (id, title, meta) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET modified_at = NOW()`,
      [wbId, 'Demo Workbook', { title: 'Demo' }]
    );

    await pool.query(
      `INSERT INTO nc_sheets (id, workbook_id, name, row_count, col_count, visible)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [sheetId, wbId, 'Sheet1', 1000, 50, true]
    );

    const cells = [
      { row: 1, col: 1, address: 'A1', data_type: 'string', raw: 'Hello' },
      { row: 1, col: 2, address: 'B1', data_type: 'number', raw: '123' },
      { row: 2, col: 1, address: 'A2', data_type: 'formula', formula: '=SUM(1,2)' },
    ];

    for (const c of cells) {
      await pool.query(
        `INSERT INTO nc_cells (sheet_id, row, col, address, data_type, raw, formula)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (sheet_id, row, col) DO UPDATE SET raw = EXCLUDED.raw, formula = EXCLUDED.formula, data_type = EXCLUDED.data_type, updated_at = NOW()`,
        [sheetId, c.row, c.col, c.address, c.data_type || null, c.raw || null, c.formula || null]
      );
    }

    res.json({ ok: true, workbookId: wbId, sheetId });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Range fetch API for lazy loading
app.get('/cells', async (req, res) => {
  try {
    const { sheetId, rowStart, rowEnd, colStart, colEnd } = req.query;
    if (!sheetId) return res.status(400).json({ error: 'sheetId is required' });

    const r1 = parseInt(rowStart || '1', 10);
    const r2 = parseInt(rowEnd || '100', 10);
    const c1 = parseInt(colStart || '1', 10);
    const c2 = parseInt(colEnd || '20', 10);

    const { rows } = await pool.query(
      `SELECT row, col, address, data_type, raw, formula, computed, style
       FROM nc_cells
       WHERE sheet_id = $1
         AND row BETWEEN $2 AND $3
         AND col BETWEEN $4 AND $5
       ORDER BY row, col`,
      [sheetId, r1, r2, c1, c2]
    );

    res.json({ sheetId, rowStart: r1, rowEnd: r2, colStart: c1, colEnd: c2, cells: rows });
  } catch (error) {
    console.error('Fetch cells error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});