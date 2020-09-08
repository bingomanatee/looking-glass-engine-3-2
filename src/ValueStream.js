import {BehaviorSubject, Subject, combineLatest} from 'rxjs';
import {
  distinct, distinctUntilChanged, filter, map,
} from 'rxjs/operators';
import {proppify} from '@wonderlandlabs/propper';

import isEqual from 'lodash.isequal';
import {
  isArray, isFunction, isObject, isString,
} from './validators';

import {
  ACTION_NEXT, STAGE_BEGIN, STAGE_COMPLETE, STAGE_PENDING, STAGE_PERFORM, STAGE_PROCESS,
} from './constants';
import {ABSENT, ID, isAbsent} from './absent';
import uniq from './uniq';
import flatten from './flatten';
import pick from './pick';
import asMap from './asMap';
import Change from "./Change";

const BRACKETS = [STAGE_BEGIN, STAGE_COMPLETE];
const DEFAULT_STAGES = [STAGE_BEGIN, STAGE_PROCESS, STAGE_PENDING, STAGE_COMPLETE];
const DEAULT_STAGE_KEY = Symbol('default stages');

const changeKeys = (change) => ({
  action: change.value.action,
  stage: change.value.stage,
});

const cleanStages = (list) => {
  if (!isArray(list)) list = [];
  let stages = list.filter((ele) => !BRACKETS.includes(ele));
  stages = uniq(flatten([STAGE_BEGIN, stages, STAGE_PROCESS, STAGE_COMPLETE])).filter(ID);
  return stages;
};

// after a value has changes

export default class ValueStream {
  constructor(initial = null, config = {}) {
    this.extend(config);
    this._watchForNext();
    this._watchForActions();
    this.next(initial);
  }

  extend(config) {
    if (!(config && isObject(config))) {
      return this;
    }

    const configMap = asMap(config);
    if (configMap.has('actions')) {
      this.addActions(configMap.get('actions'));
    }
    if (configMap.has('nextStages')) {
      this.setStages(ACTION_NEXT, configMap.get('nextStages'));
    }

    if (configMap.has('defaultStages')) {
      this.setDefaultStages(configMap.get('defaultStages'));
    }

    if (configMap.has('actionStages')) {
      asMap(configMap.get('actionStages')).forEach((stages, action) => this.setStages(action, stages));
    }

    return this;
  }

  execute(action, value, stages = ABSENT) {
    const change = new Change(this, action, value);
    change.pipe(distinct(({ stage }) => stage))
      .subscribe(() => {
        this.eventSubject.next(change);
      }, () => {
        this.errorSubject.next(change);
      });

    let execStages = stages;
    if (isAbsent(stages)) {
      execStages = this.stagesFor(action);
    } else {
      execStages = cleanStages(stages);
    }

    execStages.forEach((stage) => {
      if (stage && !change.isStopped) {
        change.nextStage(stage);
      }
    });

    if (!change.isStopped) {
      change.complete();
    }

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
    return this.execute(ACTION_NEXT, value);
  }

  _watchForNext() {
    this.on({action: ACTION_NEXT, stage: STAGE_COMPLETE}, (change) => {
      this._valueSubject.next(change.value);
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
      const keys = Array.from(Object.keys(condition));
      selectedEvents = this.eventSubject
        .pipe(filter((change) => {
          if (change.hasError) return false;
          return keys.reduce((match, key) => {
            if (!match) return match;
            const condValue = condition[key];
            const changeValue = change[key];

            if (isFunction(condValue)) {
              return condValue(changeValue, change, this);
            }
            if (condValue instanceof RegExp) {
              return isString(changeValue) && condValue.test(changeValue);
            }
            if (isArray(condValue)) {
              return condValue.includes(changeValue);
            }
            if (isObject(condValue)) {
              return isEqual(condValue, changeValue);
            }

            return condValue === changeValue;
          }, true);
        }));
    } else if (isFunction(condition)) {
      selectedEvents = this.eventSubject.pipe(filter(
        (change) => !change.hasError,
        ),
        filter((change) => condition(change, this)));
    } else {
      throw new Error('on requires object or functional condition');
    }

    const sub = selectedEvents.subscribe((change) => {
      try {
        response(change);
      } catch (error) {
        change.error(error);
      }
    });
    this.subSets.add(sub);
    return sub;
  }

  _watchForActions() {
    this.on((change, store) => {
      const isPerform = (change.stage === STAGE_PROCESS);
      const matchedAction = store.actions.has(change.action);
      const out = isPerform && matchedAction;
      return out;
    }, (change) => {
      if (change.hasError) return;
      const args = isArray(change.value) ? change.value : [];
      try {
        change.output = this.actions.get(change.action)(...args);
      } catch (err) {
        change.error(err);
      }
    });
  }

  setDefaultStages(list) {
    if (!isArray(list)) {
      throw new Error('must be an array');
    }
    this.setStages(DEAULT_STAGE_KEY, list);
    return this;
  }

  setNextStages(...stages) {
    this.setStages(ACTION_NEXT, stages);
    return this;
  }

  setStages(action, stages) {
    this._stages.set(action, cleanStages(stages));
    return this;
  }

  stagesFor(action) {
    if (this._stages.has(action)) {
      return this._stages.get(action);
    }

    if (this._stages.has(DEAULT_STAGE_KEY)) {
      return this._stages.get(DEAULT_STAGE_KEY);
    }
    return DEFAULT_STAGES;
  }

  get value() {
    return this._valueSubject.value;
  }

  get _changePipe() {
    if (!this.__changePipe) {
      let changeSet = new Set();
      this.__changePipe = new BehaviorSubject(changeSet);
      this.on({stage: STAGE_BEGIN}, (change) => {
        if (!changeSet.has(change)) {
          changeSet = new Set(changeSet);
          changeSet.add(change);
          this.__changePipe.next(changeSet);

          const unsub = () => {
            changeSet = new Set(changeSet);
            changeSet.delete(change);
            this.__changePipe.next(changeSet);
          };
          change.subscribe(ID, unsub, unsub);
        }
      });
    }
    return this.__changePipe;
  }

  filter(fn) {
    this.on({action: ACTION_NEXT, stage: STAGE_BEGIN}, (change) => {
      change.next(fn(change.value, this));
    });
    return this;
  }

  get changeSubject() {
    if (!this.__distinctSubject) {
      this.__distinctSubject = combineLatest(this._valueSubject, this._changePipe)
        .pipe(
          filter(([__, pending]) => pending.size === 0),
          map(([value]) => value),
        );
    }
    return this.__distinctSubject;
  }

  subscribe(...args) {
    const sub = this.changeSubject.subscribe(...args);
    this.subSets.add(sub);
    return sub;
  }

  addActions(obj) {
    if (!isObject(obj)) {
      throw new Error('non-obj set to addActions');
    }

    Object.keys(obj).forEach((name) => {
      const def = obj[name];
      if (isArray(def)) {
        if (isFunction(def[0])) {
          this.action(name, ...def);
          return;
        }
      } else if (isFunction(def)) {
        this.action(name, def);
        return;
      }
      console.log('bad action definition:', name, def);
    });
    return this;
  }

  get _proxyHandler() {
    return {
      get(target, name) {
        return (...args) => {
          const change = target.execute(name, args);
          if (change.hasError) {
            throw change.thrownError;
          }
          return change.output;
        };
      },
    };
  }

  _updateDoNoProxy() {
    this._do = {};
    this.actions.forEach((action, name) => this._do[name] = (...args) => this.execute(name, args));
  }

  get do() {
    if (!this._do) {
      this._updateDo(true);
    }
    return this._do;
  }

  _updateDo(upsert) {
    if (typeof Proxy === 'undefined') {
      this._updateDoNoProxy(upsert);
      return;
    }
    if (!this._do) {
      this._do = new Proxy(this, this._proxyHandler);
    }
  }

  action(name, fn, stages = ABSENT) {
    if (this.actions.has(name)) throw new Error(`cannot rename ${name}`);

    this.actions.set(name, (...args) => fn(this, ...args));
    if (isArray(stages)) {
      this.setStages(name, stages);
    }
    this._updateDo();
    return this;
  }

  get actions() {
    if (!this._actions) {
      this._actions = new Map();
    }
    return this._actions;
  }

  complete() {
    this.subSets.forEach((s) => s.complete());
    this._valueSubject.complete();
    this._eventSubject.complete();
  }
}

proppify(ValueStream)
  .addProp('subSets', () => (new Set()))
  .addProp('_stages', () => new Map())
  .addProp('parent', null)// type restrict?
  .addProp('eventSubject', () => new Subject())
  .addProp('errorSubject', () => new Subject())
  .addProp('_valueSubject', () => (new BehaviorSubject()));
