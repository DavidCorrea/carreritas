/**
 * In-progress run: timing, countdown, ghost recording, series progress, and last result flag.
 * Track / rules / player physics stay on Game and Player. Mutate only through methods.
 */
export default class Race {
  #raceTimer = 0;
  #countdownTimer = 0;
  #countdownValue = 0;
  #recording = [];
  #recordAccum = 0;
  #lastRaceWasRecord = false;
  #currentStageIndex = 0;
  #seriesResults = [];

  get raceTimer() {
    return this.#raceTimer;
  }

  get currentStageIndex() {
    return this.#currentStageIndex;
  }

  get lastRaceWasRecord() {
    return this.#lastRaceWasRecord;
  }

  /** Snapshot for read-only use (e.g. share text); do not mutate. */
  getSeriesResultsSnapshot() {
    return Object.freeze(this.#seriesResults.slice());
  }

  /** Ghost replay buffer for the current attempt (same array saveBest encodes). */
  getRecording() {
    return this.#recording;
  }

  /** Reset race clock and traffic-light countdown for a new start from the grid. */
  resetClocksForCountdown() {
    this.#raceTimer = 0;
    this.#countdownTimer = 0;
    this.#countdownValue = 0;
  }

  /**
   * Advance start lights; call once per frame with dt.
   * @returns {{ lightChanged: boolean, lit: number, showGreen: boolean, shouldStartRacing: boolean }}
   */
  advanceCountdown(dt) {
    this.#countdownTimer += dt;
    let lit = Math.floor(this.#countdownTimer);
    if (lit > 3) lit = 3;
    let lightChanged = false;
    if (lit !== this.#countdownValue) {
      this.#countdownValue = lit;
      lightChanged = true;
    }
    return {
      lightChanged,
      lit,
      showGreen: this.#countdownTimer >= 3.0 && this.#countdownTimer < 3.6,
      shouldStartRacing: this.#countdownTimer >= 3.6,
    };
  }

  /** First sample after lights; begins periodic recording during the race. */
  beginRecordingFromPlayer(player) {
    const { x, z, a } = player.getReplaySample();
    this.#recording = [{ x, z, a }];
    this.#recordAccum = 0;
  }

  addRaceTime(dt) {
    this.#raceTimer += dt;
  }

  /** Accumulate dt and append a sample when interval elapsed (in-race ghost capture). */
  addRecordingTick(dt, interval, x, z, a) {
    this.#recordAccum += dt;
    if (this.#recordAccum >= interval) {
      this.#recordAccum -= interval;
      this.#recording.push({ x, z, a });
    }
  }

  /** Final pose when crossing the line (included in replay). */
  appendFinalRecordingSample(x, z, a) {
    this.#recording.push({ x, z, a });
  }

  setLastRaceWasRecord(value) {
    this.#lastRaceWasRecord = value;
  }

  /** When starting a series run from stage 1, drop previous series totals. */
  clearSeriesResultsIfFirstStage() {
    if (this.#currentStageIndex === 0) {
      this.#seriesResults = [];
    }
  }

  incrementStageIndex() {
    this.#currentStageIndex++;
  }

  pushSeriesStageResult(entry) {
    this.#seriesResults.push(entry);
  }

  /** Back to menu / full retry of a series or single race. */
  resetSeriesProgress() {
    this.#currentStageIndex = 0;
    this.#seriesResults = [];
  }

  isFinalStage(stageCount) {
    return this.#currentStageIndex >= stageCount - 1;
  }
}
