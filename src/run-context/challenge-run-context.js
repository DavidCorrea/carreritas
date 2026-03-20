import RunContext from './context.js';
import { utcDateStr, utcMondayStr } from '../utils/index.js';

export default class ChallengeRunContext extends RunContext {
  constructor(challengeMode) {
    super();
    this.challengeMode = challengeMode;
  }

  getChallengeMode() {
    return this.challengeMode;
  }

  getChallengeSlug() {
    return this.challengeMode.slug();
  }

  getChallengeKey(dateStr, mondayStr) {
    return this.challengeMode.toKey(dateStr, mondayStr);
  }

  openLeaderboardPanel(game) {
    game.showLeaderboardForChallenge(this.challengeMode);
  }

  resultsTitleAfterSeriesComplete(r, challengeLabel) {
    return challengeLabel(this.challengeMode) + r.completeSuffix;
  }

  resultsTitleAfterSingleRaceComplete(r, challengeLabel) {
    return challengeLabel(this.challengeMode) + r.completeSuffix;
  }

  maybeSaveSeriesChallengeTime(game, totalTime) {
    if (!game.authManager.isLoggedIn()) return;
    const key = this.getChallengeKey(utcDateStr(), utcMondayStr());
    if (key) {
      game.apiClient.saveChallengeTime(key, totalTime).catch(function () {});
    }
  }

  addShareIntroLines(lines, challengeLabel) {
    lines.push(challengeLabel(this.challengeMode));
  }

  trackCodeForRestartNonSeries(game) {
    return game.currentTrackCode;
  }
}
