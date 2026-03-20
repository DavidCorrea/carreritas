/**
 * Dev-only mock responses for challenge leaderboards (see Constants.fakeChallengeLeaderboards).
 * Current user rank per mode: daily-race #1, daily-series #4, weekly-race #10, weekly-series #12.
 */

const FAKE_FETCH_DELAY_MS = 650;

const RANK_BY_MODE = {
  'daily-race': 1,
  'daily-series': 4,
  'weekly-race': 10,
  'weekly-series': 12
};

const FAKE_COUNTRIES = ['US', 'DE', 'JP', 'BR', 'FR', 'GB', 'CA', 'AU', 'ES', 'IT'];

function countryAt(i) {
  return FAKE_COUNTRIES[i % FAKE_COUNTRIES.length];
}

function baseTime(index) {
  return 50000 + index * 2000;
}

function buildFakeChallengeLeaderboardData(modeSlug, username, country) {
  const rank = RANK_BY_MODE[modeSlug];
  if (!rank) return { entries: [], total_count: 0 };

  const displayName = username || 'Guest';
  const userCountry = country || 'US';

  if (rank <= 10) {
    const entries = [];
    let botIdx = 0;
    for (let r = 1; r <= 10; r++) {
      const t = baseTime(r - 1);
      if (r === rank) {
        entries.push({
          username: displayName,
          country: userCountry,
          time_ms: t,
          recorded_at: new Date().toISOString()
        });
      } else {
        botIdx++;
        entries.push({
          username: 'BOT_' + String(botIdx).padStart(2, '0'),
          country: countryAt(r + botIdx),
          time_ms: t,
          recorded_at: new Date().toISOString()
        });
      }
    }
    return { entries, total_count: 15 };
  }

  const entries = [];
  for (let i = 0; i < 10; i++) {
    entries.push({
      username: 'BOT_' + String(i + 1).padStart(2, '0'),
      country: countryAt(i),
      time_ms: baseTime(i),
      recorded_at: new Date().toISOString()
    });
  }
  return {
    entries,
    total_count: 15,
    user_entry: {
      username: displayName,
      country: userCountry,
      time_ms: baseTime(11),
      rank: 12
    }
  };
}

/**
 * @param {string} modeSlug
 * @param {string | null} username
 * @param {string | null} country
 * @returns {Promise<{ entries: object[], total_count: number, user_entry?: object }>}
 */
export async function fakeChallengeLeaderboardData(modeSlug, username, country) {
  await new Promise((resolve) => setTimeout(resolve, FAKE_FETCH_DELAY_MS));
  return buildFakeChallengeLeaderboardData(modeSlug, username, country);
}
