import Constants from '../constants.js';
import { strings } from '../strings.js';
import {
  formatTime, pickRandom, formatDescriptor, challengeLabel, encodeTrackShareToken
} from '../utils/index.js';

function sharePageBase() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin + '/';
  }
  return Constants.share.base;
}

/** Fills the results overlay and builds share URL/text after a run. */
export default class ResultsPresenter {
  constructor(resultsScreen) {
    this._results = resultsScreen;
  }

  shareURL(game) {
    const base = sharePageBase();
    if (game.seriesMode) {
      const results = game.currentRun.getSeriesResultsSnapshot();
      const tokens = [];
      for (let i = 0; i < results.length; i++) {
        const sr = results[i];
        tokens.push(encodeTrackShareToken(sr.code, sr.direction, sr.mode, game.totalLaps));
      }
      return base + '?s=' + tokens.join(',');
    }
    return base + '?r=' + encodeTrackShareToken(
      game.currentTrackCode,
      game.direction,
      game.mode,
      game.totalLaps
    );
  }

  buildShareText(game) {
    const sh = strings.share;
    const r = strings.results;
    const run = game.currentRun;
    const openers = run.lastRaceWasRecord ? sh.openersRecord : sh.openers;
    const closers = run.lastRaceWasRecord ? sh.closersRecord : sh.closers;
    const lines = [pickRandom(openers), ''];

    game.runContext.addShareIntroLines(lines, (cm) => challengeLabel(cm));

    if (game.seriesMode) {
      const seriesSnapshot = run.getSeriesResultsSnapshot();
      let totalTime = 0;
      for (let sk = 0; sk < seriesSnapshot.length; sk++) totalTime += seriesSnapshot[sk].time;
      lines.push(r.shareStagesLine(game.stageCount, formatTime(totalTime)));
      for (let sl = 0; sl < seriesSnapshot.length; sl++) {
        const sr = seriesSnapshot[sl];
        lines.push('#' + (sl + 1) + '  ' + formatTime(sr.time));
      }
    } else {
      lines.push(r.shareTimeLine(formatTime(game.player.finishTime)));
      if (game.player.lapTimes.length > 1) {
        const fastestLap = Math.min.apply(null, game.player.lapTimes);
        for (let i = 0; i < game.player.lapTimes.length; i++) {
          const marker = game.player.lapTimes[i] === fastestLap ? r.starFastest : '';
          lines.push(r.shareLapLine(i + 1, formatTime(game.player.lapTimes[i]), marker));
        }
      }
    }

    lines.push('');
    lines.push(pickRandom(closers));
    lines.push(this.shareURL(game));
    return lines.join('\n');
  }

  /**
   * Finalize ghost buffer, persist best if needed, and populate the results overlay.
   * Caller transitions to FinishedState.
   */
  present(game) {
    this._results.clear();
    const run = game.currentRun;
    const sample = game.player.getReplaySample();
    run.appendFinalRecordingSample(sample.x, sample.z, sample.a);
    const isNewBest = !game.bestTime || game.player.finishTime < game.bestTime;
    run.setLastRaceWasRecord(isNewBest);
    if (isNewBest) game.saveBest(game.currentTrackCode, game.player.finishTime, run.getRecording());

    const labelFn = (cm) => challengeLabel(cm);
    const results = this._results;

    if (game.seriesMode) {
      run.pushSeriesStageResult({
        code: game.currentTrackCode,
        direction: game.direction,
        mode: game.mode,
        time: game.player.finishTime,
        lapTimes: game.player.lapTimes.slice(),
        isNewBest
      });

      const isFinalStage = run.isFinalStage(game.stageCount);

      if (isFinalStage) {
        const r = strings.results;
        results.setTitle(game.runContext.resultsTitleAfterSeriesComplete(r, labelFn));
        const seriesSnapshot = run.getSeriesResultsSnapshot();
        let totalTime = 0;
        for (let si = 0; si < seriesSnapshot.length; si++) totalTime += seriesSnapshot[si].time;
        results.setTrackText(game.stageCount + ' stages \u00B7 ' + formatTime(totalTime));
        results.showCopyButton(false);
        results.showShareButton(true);

        for (let sj = 0; sj < seriesSnapshot.length; sj++) {
          const sr = seriesSnapshot[sj];
          results.addRow(
            r.seriesRow(sj + 1, formatTime(sr.time), formatDescriptor(sr.code, sr.direction, sr.mode, game.totalLaps)),
            { className: sr.isNewBest ? 'lap-time lap-fastest' : 'lap-time' }
          );
        }
        results.setPrompt(strings.document.results.promptRetryMenu);

        results.showLeaderboardButton(!!game.runContext.getChallengeMode());
      } else {
        const r = strings.results;
        results.setTitle(r.stageComplete(run.currentStageIndex + 1));
        results.setTrackText(formatDescriptor(game.currentTrackCode, game.direction, game.mode, game.totalLaps));
        results.showCopyButton(true);
        results.showShareButton(false);

        if (isNewBest) results.addNewRecordBadge();

        results.addRow(r.timeRow(formatTime(game.player.finishTime)), { className: 'player' });

        const fastestStageLap = Math.min.apply(null, game.player.lapTimes);
        for (let li = 0; li < game.player.lapTimes.length; li++) {
          results.addRow(
            r.lapRow(li + 1, formatTime(game.player.lapTimes[li])),
            { className: game.player.lapTimes[li] === fastestStageLap ? 'lap-time lap-fastest' : 'lap-time' }
          );
        }
        results.setPrompt(r.promptNextStage(run.currentStageIndex + 2));
        results.showLeaderboardButton(!!game.runContext.getChallengeMode());
      }
    } else {
      const r = strings.results;
      results.setTitle(game.runContext.resultsTitleAfterSingleRaceComplete(r, labelFn));
      results.setTrackText(formatDescriptor(game.currentTrackCode, game.direction, game.mode, game.totalLaps));
      results.showCopyButton(true);
      results.showShareButton(true);

      if (isNewBest) results.addNewRecordBadge();

      results.addRow(r.timeRow(formatTime(game.player.finishTime)), { className: 'player' });
      results.addRow(r.bestRow(formatTime(game.bestTime)), { className: 'best' });

      if (!isNewBest) {
        results.addRow(r.deltaRow((game.player.finishTime - game.bestTime).toFixed(2)), { color: '#e8944d' });
      }

      const fastestRaceLap = Math.min.apply(null, game.player.lapTimes);
      for (let lj = 0; lj < game.player.lapTimes.length; lj++) {
        results.addRow(
          r.lapRow(lj + 1, formatTime(game.player.lapTimes[lj])),
          { className: game.player.lapTimes[lj] === fastestRaceLap ? 'lap-time lap-fastest' : 'lap-time' }
        );
      }
      results.setPrompt(strings.document.results.promptRetryMenu);
      results.showLeaderboardButton(!!game.runContext.getChallengeMode());
    }
  }
}
