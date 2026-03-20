import RunContext from './context.js';

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

  maybeSaveSeriesChallengeTime(_game, _totalTime) {
    /* Leaderboard POST runs from Game._submitChallengeLeaderboard after the series completes. */
  }

  addShareIntroLines(lines, challengeLabel) {
    lines.push(challengeLabel(this.challengeMode));
  }

  trackCodeForRestartNonSeries(game) {
    return game.currentTrackCode;
  }
}
