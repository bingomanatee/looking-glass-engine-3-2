import { BehaviorSubject, Subject, combineLatest } from 'rxjs';
import {
  distinct, distinctUntilChanged, filter, map,
} from 'rxjs/operators';
import { proppify } from '@wonderlandlabs/propper';

import { isFunction, isObject } from './validators';
import changeSubject from './changeSubject';
import {
  ACTION_NEXT, STAGE_BEGIN, STAGE_COMPLETE, STAGE_PENDING, STAGE_PERFORM, STAGE_PROCESS,
} from './constants';
import { ABSENT, ID, isAbsent } from './absent';
import uniq from './uniq';
import flatten from './flatten';

const changeKeys = (change) => ({
  action: change.value.action,
  stage: change.value.stage,
});

const compareChangeSigs = ({ action, stage }, prev) => (action === prev.action && stage === prev.stage);

// after a value has changes

export default class ValueStream {
  constructor(initial = null, config = {}) {
    /*   this.eventSubject.subscribe((c) => console.log('---------change: ', c.value),
      (e) => console.log('----------- error: ', e)); */
    this._watchForNext();
    this._watchForActions();

    if (config && isObject(config)) {
      if (config.actions) {
        this.addActions(config.actions);
      }
      if (config.nextStages) {
        this.nextStages = config.nextStages;
      }
    }

    this.next(initial);
  }

  get bufferedSubject() {
    if (!this._bufferedSubject) {
      const changeSet = new Set();
      this._bufferedSubject = new BehaviorSubject(0);

      this.eventSubject.subscribe((change) => {
        if (!changeSet.has(change)) {
          changeSet.add(change);
          this._bufferedSubject.next(changeSet.size);
          const purgeChange = () => changeSet.remove(change);
          change.subscribe(ID, purgeChange, purgeChange);
        }
      });
    }
    return this._bufferedSubject;
  }

  execute(action, value, stages = []) {
    const change = changeSubject(action, value, STAGE_BEGIN);
    change.pipe(distinct(({ stage }) => stage))
      .subscribe(() => {
        this.eventSubject.next(change);
      }, () => {
        this.errorSubject.next(change);
      });

    uniq([...stages, STAGE_COMPLETE]).forEach((stage) => {
      if (!stage) return;
      if (!change.isStopped) {
        change.next({ ...change.value, stage });
      }
    });

    return change;
  }

  /**
   * this merges values into the values stream.
   * this is the worst way to update values as it short circuits the change
   * sykstem.
   *
   * @param value
   */
  next(value) {
    return this.execute(ACTION_NEXT, value, this.nextStages);
  }

  _watchForNext() {
    this.on({ action: ACTION_NEXT, stage: STAGE_COMPLETE }, (change) => {
      this._valueSubject.next(change.value.value);
      if (!change.hasError) {
        this.errorSubject.next(false);
      }
    });
  }

  on(condition, response) {
    if (!isFunction(response)) {
      throw new Error('on must end in a function');
    }
    let selectedEvents;
    if (isObject(condition)) {
      selectedEvents = this.eventSubject
        .pipe(filter((change) => {
          if (change.hasError) return false;
          const filtered = Array.from(Object.keys(condition)).reduce(
            (valid, name) => {
              if (!valid) return false;
              const target = condition[name];
              const changeProp = change.value[name];
              return target === changeProp;
            }, true,
          );
          return filtered;
        }));
    } else if (isFunction(condition)) {
      selectedEvents = this.eventSubject.pipe(filter(condition));
    }
    if (selectedEvents) {
      this.subSets.add(selectedEvents.subscribe((change) => {
        try {
          response(change);
        } catch (error) {
          console.log('on error:', error);
          change.error(error);
        }
      }));
    }
    return this;
  }

  _watchForActions() {
    this.subSets.add(this.eventSubject.pipe(filter((change) => {
      const { stage } = change.value;
      return stage === STAGE_PERFORM;
    }))
      .subscribe((change) => {
        if (!this.actions.has(change.value.action)) {
          change.error(new Error(`no action named ${change.value.action}`));
        } else {
          try {
            this.actions.get(change.value.action)(this, ...change.value.value);
          } catch (err) {
            change.error(err);
          }
        }
      }));
  }

  setNextStages(...stages) {
    this.nextStages = uniq(flatten(stages));
    return this;
  }

  valueToMap() {
    if (!(this.value instanceof Map)) {
      if (this.value && isObject(this.value)) {
        const next = Array.from(Object.keys(this.value))
          .reduce((memo, key) => {
            memo.set(key, this.value[key]);
            return memo;
          }, new Map());
        this.next(next);
      } else {
        this.next(new Map());
      }
    }
    return this;
  }

  // not currently employed
  doAction(name, ...args) {
    if (!this.actions.has(name)) {
      throw new Error(`no action named ${name}`);
    }
    return this.execute(name, args, [STAGE_PERFORM]);
  }

  get value() {
    return this._valueSubject.value;
  }

  subscribe(...args) {
    const sub = this._valueSubject.subscribe(...args);
    this.subSets.add(sub);
    return sub;
  }

  get _bufferedValues() {
    if (!this.__bufferedValues) {
      this.__bufferedValues = combineLatest(this.bufferedSubject, this._valueSubject)
        .pipe(filter(([count]) => count < 1),
          map(([_, v]) => v));
    }
    return this.__bufferedValues;
  }

  subscribeWhenComplete(...args) {
    const sub = this._bufferedValues.subscribe(...args);
    this.subSets.add(sub);
    return sub;
  }

  addActions(obj) {
    if (!isObject(obj)) {
      throw new Error('non-obj set to addActions');
    }

    Object.keys(obj).forEach((name) => {
      this.action(name, obj[name]);
    });
    return this;
  }

  action(name, fn, rewrite = false) {
    if ((!rewrite) && this.actions.has(name)) throw new Error(`cannot rename ${name}`);
    // @TODO- pipe through process, handle errors
    this.actions.set(name, (...args) => fn(this, ...args));
    return this;
  }

  get actions() {
    if (!this._actions) { this._actions = new Map(); }
    return this._actions;
  }

  get streams() {
    if (!this._streams) { this._streams = new Map(); }
    return this._streams;
  }
}

proppify(ValueStream)
  .addProp('subSets', () => (new Set()))
  .addProp('parent', null)// type restrict?
  .addProp('nextStages', () => ([STAGE_PROCESS, STAGE_PENDING]))
  .addProp('eventSubject', () => new Subject())
  .addProp('errorSubject', () => new Subject())
  .addProp('_valueSubject', () => (new BehaviorSubject()));
