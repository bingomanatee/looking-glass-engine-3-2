import { BehaviorSubject, Subject, combineLatest } from 'rxjs';
import {
  distinct, distinctUntilChanged, filter, map,
} from 'rxjs/operators';
import { proppify } from '@wonderlandlabs/propper';

import isEqual from 'lodash.isequal';
import {
  isArray, isFunction, isObject, isString,
} from './validators';

import {
  ACTION_KEY_VALUE_SET,
  ACTION_NEXT, STAGE_BEGIN, STAGE_COMPLETE, STAGE_PENDING, STAGE_PERFORM, STAGE_PROCESS,
} from './constants';
import { ABSENT, ID, isAbsent } from './absent';
import uniq from './uniq';
import flatten from './flatten';
import pick from './pick';
import asMap from './asMap';
import Change from './Change';

const BRACKETS = [STAGE_BEGIN, STAGE_PENDING, STAGE_COMPLETE];
const DEFAULT_STAGES = [STAGE_BEGIN, STAGE_PROCESS, STAGE_PENDING, STAGE_COMPLETE];
const DEFAULT_STAGE_KEY = Symbol('default stages');
const ACTION_MAP_SET_STAGES = DEFAULT_STAGES;

const cleanStages = (list) => {
  if (!isArray(list)) list = [];
  let stages = list.filter((ele) => !BRACKETS.includes(ele));
  stages = uniq(flatten([STAGE_BEGIN, stages, STAGE_PROCESS, STAGE_PENDING, STAGE_COMPLETE])).filter(ID);
  return stages;
};

// after a value has changes

/**
 * An observable for a single item.
 * Provides enahnced observaation of change sequenced through stages,
 * actions, and observation of action .
 */
export default class ValueStream {
  /**
   *
   * @param {any} initial
   * @param {Object} config
   */
  constructor(initial = null, config = {}) {
    this.extend(config);
    this._watchForNext();
    this._watchForActions();
    this.next(initial);
  }

  /**
   * Sets the configuration of actions and stages.
   * while called on initialization,
   * can be called at any point to configure or extend the stream.
   * note - configuration also accepts a Msp.
   * @param {Object} config
   * @param {[Map]} config.actions
   * @returns {ValueStream}
   */
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
   *
   * @param {any} value
   * @return {Change}
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

  /**
   * observes all change flow for a particular subset of events
   * @param {String | Object|function} condition which set of changes to observe
   * @param {String} condition.action which action events to care about
   * @param {scalar} condition.stage which stage of updates to care about
   * @param {function} listener what to recieve the event with.
   *                  Note - all errors thrown by the listener will funnel into the change.
   * @returns {Subscription}
   */
  on(condition, listener) {
    if (!isFunction(listener)) {
      throw new Error('on must end in a function');
    }
    if (isString(condition)) {
      return this.on({ action: condition }, listener);
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
        listener(change);
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

  /**
   * set the stages all updates and actions will go through
   * unless they have a custom stage definition.
   *  note - all stages must:
   *    1. begin with STAGE_BEGIN,
   *    2. end with STAGE_END,
   *    3. contain STAGE_PROCESS (between those two stages.
   *    any other additional stages is up to the users' needs.
   * stages can be strings or Symbols -- and possibly other things
   * but those two types are advised.
   * @param {[scalar]} list
   * @returns {ValueStream}
   */
  setDefaultStages(list) {
    if (!isArray(list)) {
      throw new Error('must be an array');
    }
    this.setStages(DEFAULT_STAGE_KEY, list);
    return this;
  }

  /**
   * Set the stages that all updates(next) go through.
   * See setDefaultStages for expanded stage detail.
   *
   * @param {[scalar]} stages
   * @returns {ValueStream}
   */
  setNextStages(...stages) {
    this.setStages(ACTION_NEXT, stages);
    return this;
  }

  /**
   * Sets the stage for an action.
   * See setDefaultStages for expanded stage detail.
   *
   * @param {String} action
   * @param {[Scalar]} stages
   * @returns {ValueStream}
   */
  setStages(action, stages) {
    this._stages.set(action, cleanStages(stages));
    return this;
  }

  /**
   * returns the stages that a given action will trigger.
   * @param {String} action
   * @returns {[Scalar]}
   */
  stagesFor(action) {
    if (action === ACTION_KEY_VALUE_SET) return ACTION_MAP_SET_STAGES;
    if (this._stages.has(action)) {
      return this._stages.get(action);
    }

    if (this._stages.has(DEFAULT_STAGE_KEY)) {
      return this._stages.get(DEFAULT_STAGE_KEY);
    }
    return DEFAULT_STAGES;
  }

  /**
   * the current value of the Stream.
   * @returns {*}
   */
  get value() {
    return this._valueSubject.value;
  }

  /**
   * A stream that only updates if a value is changed and all changes have been completed.
   * @returns {BehaviorSubject<unknown>}
   * @private
   */
  get _changePipe() {
    if (!this.__changePipe) {
      let changeSet = new Set();
      this.__changePipe = new BehaviorSubject(changeSet);
      this.on({ stage: STAGE_BEGIN }, (change) => {
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

  /**
   * A shorthand for adding a listener to the initial update of the stream.
   * Note - gets the changes' value, not the change itself.
   * The result of the function updates the value updates the changes' value,
   * and the value that is passed to subsequent listeners.
   *
   * @param {function} fn
   * @returns {ValueStream} (self)
   */
  preprocess(fn) {
    this.on({ action: ACTION_NEXT, stage: STAGE_BEGIN }, (change) => {
      change.next(fn(change.value, this));
    });
    return this;
  }

  /**
   * limit an observable to only update when all changes have been processed.
   * @param subject
   * @returns {Observable<*>}
   * @private
   */
  _bindToChange(subject) {
    return combineLatest(subject, this._changePipe)
      .pipe(
        filter(([__, pending]) => pending.size === 0),
        map(([value]) => value),
      );
  }

  /**
   * a change-bound version of the value subject.
   * @returns {Observable<*>}
   */
  get changeSubject() {
    if (!this.__distinctSubject) {
      this.__distinctSubject = this._bindToChange(this._valueSubject);
    }
    return this.__distinctSubject;
  }

  /**
   * get updates to the value.
   * @param {[function]} args onChange, onError, onComplete
   * @returns {Subscription}
   */
  subscribe(...args) {
    const sub = this.changeSubject.subscribe(...args);
    this.subSets.add(sub);
    return sub;
  }

  /**
   * adds one or more actions to the actions collection.
   * @param obj
   * @returns {ValueStream}
   */
  addActions(obj) {
    if (!isObject(obj)) {
      throw new Error('non-obj set to addActions');
    }

    const actionMap = asMap(obj);
    actionMap.forEach((def, name) => {
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
    if (!this.__proxyHandler) {
      this.__proxyHandler = {
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

    return this.__proxyHandler;
  }

  _updateDoNoProxy() {
    this._do = {};
    this.actions.forEach((action, name) => this._do[name] = (...args) => {
      const change = this.execute(name, args);
      if (change.hasError) throw change.thrownError;
      if ('output' in change) {
        return change.output;
      }
      return change;
    });
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
