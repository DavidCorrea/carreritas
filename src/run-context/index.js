import RunContext from './context.js';
import EventRunContext from './event-run-context.js';
import ChallengeRunContext from './challenge-run-context.js';

RunContext.event = function event() {
  return new EventRunContext();
};

RunContext.challenge = function challenge(challengeMode) {
  return new ChallengeRunContext(challengeMode);
};

export { EventRunContext, ChallengeRunContext };
export default RunContext;
