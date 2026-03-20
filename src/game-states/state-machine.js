export default class StateMachine {
  constructor(initialState) {
    this.current = initialState;
  }

  transitionTo(newState, context) {
    if (!this.current.canTransitionTo(newState)) {
      console.warn('Invalid state transition from', this.current.toString(), 'to', newState.toString());
      return;
    }
    this.current.onExit(context);
    this.current = newState;
    this.current.onEnter(context);
  }

  update(dt, context) {
    this.current.onUpdate(dt, context);
  }
}
