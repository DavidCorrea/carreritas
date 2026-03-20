/**
 * What kind of run the player is in. Subclasses reify Event vs Challenge;
 * add more run types later as sibling classes (e.g. TimeTrialRunContext).
 */
export default class RunContext {
  getChallengeMode() {
    return null;
  }

  getChallengeSlug() {
    return null;
  }

  getChallengeKey(_dateStr, _mondayStr) {
    return null;
  }

  openLeaderboardPanel(game) {
    game.showLeaderboardForCurrentTrack();
  }

  /** @param {object} r strings.results */
  resultsTitleAfterSeriesComplete(r, _challengeLabel) {
    return r.seriesWord + r.completeSuffix;
  }

  /** @param {object} r strings.results */
  resultsTitleAfterSingleRaceComplete(r, _challengeLabel) {
    return r.raceWord + r.completeSuffix;
  }

  maybeSaveSeriesChallengeTime(_game, _totalTime) {}

  addShareIntroLines(_lines, _challengeLabel) {}

  trackCodeForRestartNonSeries(game) {
    return game.menu.getTrackCode();
  }
}
