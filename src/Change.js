import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { STAGE_BEGIN } from './constants';

class Change {
  constructor(target, action, startValue, startStage = STAGE_BEGIN) {
    this._action = action;
    this.target = target;
    this.stageSubject = new BehaviorSubject(startStage);
    this.subject = new BehaviorSubject(startValue);
    this.stream = combineLatest([this.subject, this.stageSubject])
      // eslint-disable-next-line arrow-body-style
      .pipe(map(([value, stage]) => {
        return ({ value, stage, action: this.action });
      }));
    this.output = null;
  }

  nextStage(value) {
    this.stageSubject.next(value);
  }

  get action() {
    return this._action;
  }

  get stage() {
    return this.stageSubject.value;
  }

  complete() {
    this.subject.complete();
    this.stageSubject.complete();
  }
}

['isStopped', 'hasError', 'thrownError', 'value'].forEach((name) => {
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

['error', 'next'].forEach((name) => {
  const propDef = {
    configurable: false,
    enumerable: false,
    get() {
      return (...args) => this.subject[name](...args);
    },
  };
  Object.defineProperty(Change.prototype, name, propDef);
});

export default Change;
