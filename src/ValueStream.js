import { BehaviorSubject, Subject, combineLatest } from 'rxjs';
import {
  distinct, distinctUntilChanged, filter, map,
} from 'rxjs/operators';
import { proppify } from '@wonderlandlabs/propper';

import isEqual from 'lodash.isequal';
import { isArray, isFunction, isObject } from './validators';
import changeSubject from './changeSubject';
import {
  ACTION_NEXT, STAGE_BEGIN, STAGE_COMPLETE, STAGE_PENDING, STAGE_PERFORM, STAGE_PROCESS,
} from './constants';
import { ABSENT, ID, isAbsent } from './absent';
import uniq from './uniq';
import flatten from './flatten';
import pick from './pick';
import asMap from './asMap';

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
    /*   this.eventSubject.subscribe((c) => console.log('---------change: ', c.value),
      (e) => console.log('----------- error: ', e)); */
    this._watchForNext();
    this._watchForActions();
    this.extend(config);
    this._initDos();
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

  execute(action, value, stages = ABSENT) {
    const change = changeSubject(action, value);
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
    this.on({ action: ACTION_NEXT, stage: STAGE_COMPLETE }, (change) => {
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
          const matchingChangeValues = pick(change, keys);
          return isEqual(matchingChangeValues, condition);
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
    this.on({ stage: STAGE_PERFORM }, (change) => {
      if (change.hasError) return;
      if (this.actions.has(change.action)) {
        try {
          const args = isArray(change.value) ? change.value : [];
          const output = this.actions.get(change.action)(this, ...args);
          change.next(output);
        } catch (err) {
          change.error(err);
        }
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

  // not currently employed
  doAction(name, ...args) {
    if (!this.actions.has(name)) {
      throw new Error(`no action named ${name}`);
    }
    return this.execute(name, args);
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

  get _proxyHandler() {
    return {
      get(target, name, handler) {
        return (...args) => {
          const change = target.execute(name, args);
          if (change.hasError) {
            throw change.thrownError;
          }
          return change.value;
        };
      },
    };
  }

  _updateDoNoProxy() {
    this.do = {};
    this.actions.forEach((action, name) => this.do[name] = (...args) => this.execute(name, args));
  }

  _initDos() {
    this._updateDo();
  }

  _updateDo() {
    if (typeof Proxy === 'undefined') {
      this._updateDoNoProxy();
      return;
    }

    if (!this.do) this.do = new Proxy(this, this._proxyHandler);
  }

  action(name, fn, rewrite = false) {
    if ((!rewrite) && this.actions.has(name)) throw new Error(`cannot rename ${name}`);
    // @TODO- pipe through process, handle errors
    this.actions.set(name, (...args) => fn(this, ...args));
    this._updateDo();
    return this;
  }

  get actions() {
    if (!this._actions) { this._actions = new Map(); }
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
