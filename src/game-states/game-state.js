import Constants from '../constants.js';

/** Base + concrete states in one module to avoid circular imports between these files. */

export default class GameState {
  isMenu() { return false; }
  isCountdown() { return false; }
  isRacing() { return false; }
  isFinished() { return false; }
  equals(other) { return this.constructor === other.constructor; }
  toString() { throw new Error('Subclass must implement toString()'); }
  onEnter(_context) {}
  onExit(_context) {}
  onUpdate(_dt, _context) {}
  canTransitionTo(_newState) { return true; }

  static fromString(str) {
    if (str === 'menu') return new MenuState();
    if (str === 'countdown') return new CountdownState();
    if (str === 'racing') return new RacingState();
    if (str === 'finished') return new FinishedState();
    return new MenuState();
  }
}

export class MenuState extends GameState {
  isMenu() { return true; }
  toString() { return 'menu'; }
  canTransitionTo(newState) {
    return newState instanceof CountdownState;
  }
  onEnter(context) {
    context.hud.hide();
    context.menu.hideTouchControls();
    context.menu.show();
    context.accountBar.show();
  }
  onUpdate(dt, context) {
    if (!context.records.isOpen() && !context.settingsPanel.isOpen()) {
      if (!context.menuPreviewActive && context.player && context.track) {
        context.menuPreviewActive = true;
        context.cam.startShowcase();
        context.previewT = 0;
        context.menuPreviewLastRender = context.lastTime;
      }
      if (context.menuPreviewActive && context.player && context.track) {
        context.updatePreviewDrive(dt);
        context.cam.updateShowcase(dt, context.player);
        const now = performance.now();
        if (now - context.menuPreviewLastRender >= Constants.menu.previewFrameIntervalMs) {
          context.sceneDirty = true;
          context.menuPreviewLastRender = now;
        }
      }
    } else {
      if (context.menuPreviewActive) {
        context.menuPreviewActive = false;
        context.cam.stopShowcase();
        if (context.player) {
          context.cam.applyMode(context.player);
        }
      }
    }
  }
}

export class CountdownState extends GameState {
  isCountdown() { return true; }
  toString() { return 'countdown'; }
  canTransitionTo(newState) {
    return newState instanceof RacingState || newState instanceof MenuState;
  }
  onEnter(context) {
    context.ghost.setVisibleWhenPresent(true);
    context.menuPreviewActive = false;
    context.cam.stopShowcase();
    if (context.player && context.track) {
      context.player.resetToGrid(context.track, context.direction);
    }
    if (context.player) {
      context.cam.applyMode(context.player);
    }
    context.menu.hide();
    context.accountBar.hide();
    context.currentRun.resetClocksForCountdown();
    context.hud.clearLapTimes();
    context.hud.show();
    context.menu.showTouchControls();
    context.hud.resetCache();
    context.updateHUD();
    context.hud.resetLights();
    context.hud.showCountdown();
    context.sceneDirty = true;
  }
  onUpdate(dt, context) {
    const step = context.currentRun.advanceCountdown(dt);
    if (step.lightChanged && step.lit <= 3) {
      context.hud.setRedLights(step.lit);
    }
    if (step.showGreen) {
      context.hud.setGreen();
    }
    if (step.shouldStartRacing) {
      context.hud.hideCountdown();
      context.currentRun.beginRecordingFromPlayer(context.player);
      context.transitionToRacing();
    }
    context.sceneDirty = true;
  }
}

export class RacingState extends GameState {
  isRacing() { return true; }
  toString() { return 'racing'; }
  canTransitionTo(newState) {
    return newState instanceof FinishedState || newState instanceof CountdownState;
  }
  onEnter(_context) {
    // Recording already started in CountdownState transition
  }
  onUpdate(dt, context) {
    const race = context.currentRun;
    race.addRaceTime(dt);

    const input = context.input ? context.input.getInput(context.menu.isTrackCodeFocused()) : { accel: 0, steer: 0 };
    context.player.updatePhysics(dt, input.accel, input.steer);

    context.player.wallCollision(context.track.inner);
    context.player.wallCollision(context.track.outer);
    context.player.syncMeshTransform();

    context.player.updateLapTracking(
      context.track.sampled,
      context.direction,
      context.totalLaps,
      race.raceTimer,
      (lapNum, lapTime) => context.addLapTimeToHUD(lapNum, lapTime)
    );
    const sample = context.player.getReplaySample();
    race.addRecordingTick(dt, Constants.track.recordInterval, sample.x, sample.z, sample.a);
    context.ghost.update(race.raceTimer);

    if (context.player.finished) {
      context.showResultsScreen();
      return;
    }

    context.updateHUD();
    context.sceneDirty = true;
  }
}

export class FinishedState extends GameState {
  isFinished() { return true; }
  toString() { return 'finished'; }
  canTransitionTo(newState) {
    return newState instanceof CountdownState || newState instanceof MenuState;
  }
  onEnter(_context) {
    // Results screen setup is handled by showResultsScreen() before transition
  }
  handleEnterKey(context) {
    if (context.seriesMode && !context.currentRun.isFinalStage(context.stageCount)) {
      context.advanceToNextStage();
    } else {
      context.restartCurrentMap();
    }
  }
  handleEscapeKey(context) {
    context.restartRace();
  }
  handleSpaceKey(context) {
    this.handleEnterKey(context);
  }
}
