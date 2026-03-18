var sql;

function getDb() {
  if (!sql) {
    if (process.env.USE_LOCAL_DB) {
      var { Pool } = require('pg');
      var pool = new Pool({ connectionString: process.env.DATABASE_URL });
      sql = function (text, params) { return pool.query(text, params).then(function (r) { return r.rows; }); };
    } else {
      var { neon } = require('@neondatabase/serverless');
      sql = neon(process.env.DATABASE_URL);
    }
  }
  return sql;
}

module.exports = { getDb };
