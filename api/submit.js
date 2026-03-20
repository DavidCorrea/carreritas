const { getDb } = require('./_db');
const { sendJson } = require('./_auth');
const { sanitizeDisplayName, trimSingleTrackBoard, applyChampionGhost } = require('./_leaderboardDb');
const { seriesStagesForChallengeKey } = require('./_challenge-seed');

function parseBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function stagesMatch(expected, submitted) {
  if (!submitted || submitted.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const s = submitted[i];
    if (!s) return false;
    if (s.track_code !== e.code) return false;
    if (parseInt(s.laps, 10) !== e.laps) return false;
    if (!!s.reversed !== e.reversed) return false;
    if (!!s.night_mode !== e.night_mode) return false;
  }
  return true;
}

/**
 * Keep only top 10 series runs (by total time) for this challenge's stages.
 */
async function trimSeriesRuns(sql, challengeKey) {
  const stages = seriesStagesForChallengeKey(challengeKey);
  if (!stages || stages.length === 0) return;

  const n = stages.length;
  const params = [];
  const orParts = [];
  let p = 1;
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    orParts.push('(track_code = $' + p + ' AND laps = $' + (p + 1) + ' AND reversed = $' + (p + 2) + ' AND night_mode = $' + (p + 3) + ')');
    params.push(s.code, s.laps, s.reversed, s.night_mode);
    p += 4;
  }

  const rows = await sql(
    `SELECT series_run_id, time_ms, track_code, laps, reversed, night_mode
     FROM best_times
     WHERE series_run_id IS NOT NULL AND (${orParts.join(' OR ')})`,
    params
  );

  const byRun = new Map();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const id = row.series_run_id;
    if (!byRun.has(id)) byRun.set(id, []);
    byRun.get(id).push(row);
  }

  const totals = [];
  byRun.forEach(function (list, seriesRunId) {
    if (list.length !== n) return;
    const byKey = new Map();
    for (let j = 0; j < list.length; j++) {
      const row = list[j];
      const k = row.track_code + '|' + row.laps + '|' + row.reversed + '|' + row.night_mode;
      byKey.set(k, row.time_ms);
    }
    let sum = 0;
    for (let k = 0; k < stages.length; k++) {
      const s = stages[k];
      const key = s.code + '|' + s.laps + '|' + s.reversed + '|' + s.night_mode;
      if (!byKey.has(key)) return;
      sum += byKey.get(key);
    }
    totals.push({ series_run_id: seriesRunId, total_ms: sum });
  });

  totals.sort(function (a, b) { return a.total_ms - b.total_ms; });
  const keep = new Set(totals.slice(0, 10).map(function (t) { return t.series_run_id; }));

  const allIds = Array.from(byRun.keys());
  const drop = allIds.filter(function (id) { return !keep.has(id); });
  if (drop.length === 0) return;

  await sql(
    'DELETE FROM best_times WHERE series_run_id = ANY($1::bigint[])',
    [drop]
  );
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  let body;
  try {
    body = await parseBody(req);
  } catch (_e) {
    return sendJson(res, 400, { error: 'Invalid JSON' });
  }

  const sql = getDb();
  const display_name = sanitizeDisplayName(body.display_name);
  if (!display_name) return sendJson(res, 400, { error: 'display_name required' });

  // --- Series batch ---
  if (body.challenge_key && Array.isArray(body.stages)) {
    const key = body.challenge_key;
    const expected = seriesStagesForChallengeKey(key);
    if (!expected || !stagesMatch(expected, body.stages)) {
      return sendJson(res, 400, { error: 'stages do not match challenge' });
    }
    for (let i = 0; i < body.stages.length; i++) {
      const st = body.stages[i];
      if (st.time_ms == null || typeof st.time_ms !== 'number') {
        return sendJson(res, 400, { error: 'each stage needs time_ms' });
      }
    }

    const runRows = await sql('SELECT nextval(\'series_run_id_seq\') AS id');
    const series_run_id = parseInt(runRows[0].id, 10);

    for (let j = 0; j < body.stages.length; j++) {
      const st = body.stages[j];
      const ex = expected[j];
      await sql(
        `INSERT INTO best_times (track_code, laps, reversed, night_mode, time_ms, display_name, series_run_id, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [ex.code, ex.laps, ex.reversed, ex.night_mode, st.time_ms, display_name, series_run_id]
      );
    }

    await trimSeriesRuns(sql, key);
    return sendJson(res, 200, { ok: true, series_run_id });
  }

  // --- Single track ---
  const b = body;
  if (!b.track_code || b.laps == null || b.reversed === undefined || b.night_mode === undefined || b.time_ms == null) {
    return sendJson(res, 400, { error: 'Missing track_code, laps, reversed, night_mode, time_ms' });
  }

  const laps = parseInt(b.laps, 10);
  const reversed = !!b.reversed;
  const night_mode = !!b.night_mode;

  const ins = await sql(
    `INSERT INTO best_times (track_code, laps, reversed, night_mode, time_ms, display_name, series_run_id, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, now())
     RETURNING id`,
    [b.track_code, laps, reversed, night_mode, b.time_ms, display_name]
  );
  const insertedId = ins[0].id;

  await trimSingleTrackBoard(sql, b.track_code, laps, reversed, night_mode);
  await applyChampionGhost(
    sql,
    b.track_code,
    laps,
    reversed,
    night_mode,
    b.ghost_data || null,
    b.car_settings || null,
    insertedId
  );

  return sendJson(res, 200, { ok: true, id: insertedId });
};
