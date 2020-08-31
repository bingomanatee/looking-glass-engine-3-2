import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import isEqual from 'lodash.isequal';
import { STAGE_BEGIN } from './constants';
import pick from './pick';

const ks = (props) => ({ value: props.value, stage: props.stage });
class Change {
  constructor(action, value, stage) {
    this.action = action;

    this.subject = new BehaviorSubject({ value, stage });
    this.stream = this.subject
      .pipe(distinctUntilChanged(isEqual, ks),
        // eslint-disable-next-line no-shadow
        map(({ value, stage }) => ({ value, stage, action: this.action })));
  }

  next(props) {
    const next = { ...this.value, ...props };
    this.subject.next(pick(next, ['value', 'stage']));
  }

  get value() {
    return { ...this.subject.value, action: this.action };
  }
}

['isStopped', 'hasError', 'thrownError'].forEach((name) => {
  const propDef = {
    configurable: false,
    enumerable: true,
    get() {
      return this.subject[name];
    },
  };
  Object.defineProperty(Change.prototype, name, propDef);
});

['subscribe', 'pipe'].forEach((name) => {
  const propDef = {
    configurable: false,
    enumerable: false,
    get() {
      return (...args) => this.stream[name](...args);
    },
  };
  Object.defineProperty(Change.prototype, name, propDef);
});

['complete', 'error'].forEach((name) => {
  const propDef = {
    configurable: false,
    enumerable: false,
    get() {
      return (...args) => this.subject[name](...args);
    },
  };
  Object.defineProperty(Change.prototype, name, propDef);
});

/**
 *
 * @param action {string}
 * @param value {any}
 * @param stage {any}
 * @returns {Change}
 */
export default (action, value = undefined, stage = STAGE_BEGIN) => new Change(action, value, stage);
