import { STAGE_PROCESS } from './constants';
import { isString } from './validators';

const SET_RE = /^set([\w].*)/;
export default (change, store) => {
  if (change.stage !== STAGE_PROCESS) {
    return false;
  }
  if (store.actions.has(change.action)) {
    return false;
  }
  if (!isString(change.action)) {
    return false;
  }
  const find = SET_RE.test(change.action);
  return find;
};
