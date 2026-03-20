let sql;

function getDb() {
  if (!sql) {
    if (process.env.USE_LOCAL_DB) {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      sql = function (text, params) { return pool.query(text, params).then(function (r) { return r.rows; }); };
    } else {
      const { neon } = require('@neondatabase/serverless');
      sql = neon(process.env.DATABASE_URL);
    }
  }
  return sql;
}

module.exports = { getDb };
