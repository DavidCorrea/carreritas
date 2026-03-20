const { getDb } = require('./_db');
const { verifyToken, sendJson } = require('./_auth');
const { seriesStagesForChallengeKey } = require('./_challenge-seed');

/**
 * Build series leaderboard from best_times rows (same logic as trimSeriesRuns in submit.js).
 */
function buildSeriesTotals(rows, stages) {
  const n = stages.length;
  const byRun = new Map();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const id = row.series_run_id;
    if (id == null) continue;
    if (!byRun.has(id)) byRun.set(id, []);
    byRun.get(id).push(row);
  }

  const totals = [];
  byRun.forEach(function (list, seriesRunId) {
    if (list.length !== n) return;
    const byKey = new Map();
    let displayName = null;
    let recordedAt = null;
    for (let j = 0; j < list.length; j++) {
      const row = list[j];
      displayName = row.display_name;
      if (!recordedAt || row.recorded_at > recordedAt) recordedAt = row.recorded_at;
      const key = row.track_code + '|' + row.laps + '|' + row.reversed + '|' + row.night_mode;
      byKey.set(key, row.time_ms);
    }
    let sum = 0;
    for (let k = 0; k < stages.length; k++) {
      const s = stages[k];
      const key = s.code + '|' + s.laps + '|' + s.reversed + '|' + s.night_mode;
      if (!byKey.has(key)) return;
      sum += byKey.get(key);
    }
    totals.push({
      series_run_id: seriesRunId,
      time_ms: sum,
      display_name: displayName,
      recorded_at: recordedAt
    });
  });

  totals.sort(function (a, b) { return a.time_ms - b.time_ms; });
  return totals;
}

module.exports = async function (req, res) {
  const sql = getDb();

  if (req.method === 'GET') {
    const key = (req.query || {}).challenge_key;
    if (!key) return sendJson(res, 400, { error: 'challenge_key required' });

    const stages = seriesStagesForChallengeKey(key);
    if (!stages || stages.length === 0) {
      return sendJson(res, 400, { error: 'invalid or non-series challenge_key' });
    }

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
      `SELECT series_run_id, time_ms, track_code, laps, reversed, night_mode, display_name, recorded_at
       FROM best_times
       WHERE series_run_id IS NOT NULL AND (${orParts.join(' OR ')})`,
      params
    );

    const allTotals = buildSeriesTotals(rows, stages);
    const top = allTotals.slice(0, 10);
    const entries = top.map(function (t) {
      return {
        display_name: t.display_name,
        username: t.display_name,
        time_ms: t.time_ms,
        recorded_at: t.recorded_at,
        country: null
      };
    });

    const result = { entries, total_count: allTotals.length };

    const user = verifyToken(req);
    if (user && allTotals.length > 0) {
      const inTop = top.some(function (r) { return r.display_name === user.username; });
      if (!inTop) {
        let rank = null;
        let timeMs = null;
        for (let i = 0; i < allTotals.length; i++) {
          if (allTotals[i].display_name === user.username) {
            rank = i + 1;
            timeMs = allTotals[i].time_ms;
            break;
          }
        }
        if (rank != null) {
          result.user_entry = {
            username: user.username,
            display_name: user.username,
            country: null,
            time_ms: timeMs,
            rank
          };
        }
      }
    }

    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
};
