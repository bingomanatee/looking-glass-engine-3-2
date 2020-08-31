import { BehaviorSubject, Subject } from 'rxjs';
import { distinct, distinctUntilChanged, filter } from 'rxjs/operators';
import { proppify } from '@wonderlandlabs/propper';

import { isFunction, isObject } from './validators';
import Base from './Base';
import changeSubject from './changeSubject';
import streamArray from './streamArray';
import streamMap from './streamMap';
import {
  ACTION_NEXT, STAGE_BEGIN, STAGE_COMPLETE, STAGE_PENDING, STAGE_PERFORM, STAGE_PROCESS,
} from './constants';
import { ABSENT, isAbsent } from './absent';
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
    console.log('--- setting next: ', initial);

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
    this.subSets.add(this.eventSubject.pipe(filter((change) => {
      if (this.DEBUG) console.log('event subject got ', change.value);
      const { stage, action } = change.value;
      return stage === STAGE_COMPLETE && action === ACTION_NEXT;
    }))
      .subscribe((change) => {
        this._valueSubject.next(change.value.value);
        if (!change.hasError) {
          this.errorSubject.next(false);
        }
      }));
  }

  on(condition, response) {
    if (!isFunction(response)) {
      console.log('on must end in a function');
      return this;
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
              if (target !== changeProp) {
                return false;
              }
              return true;
            }, true,
          );
          console.log('change:', change.value, 'cond:', condition,
            'filtered: ', filtered);
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

  valueToStreams() {
    this.valueToMap();
    this.value.forEach((value, name) => {
      this.addStream(name, value);
    });
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

  addStream(name, value = ABSENT, stream = null) {
    if (this.streams.has(name)) {
      throw new Error(`cannot redefine ${name}`);
    }

    if (isAbsent(value)) {
      value = this.value.get(name) || null;
    }

    this.streams.set(name, stream || new ValueStream(value));

    if (stream.errorSubject) {
      stream.errorSubject.subscribe((error) => {
        this.errorSubject.next({ stream: name, error });
      });
    }

    this.subSets.add(stream.subscribe((next) => {
      const nextMap = new Map(this.value);
      nextMap.set(name, next);
      return this.next(nextMap);
    }, (error) => {
      console.log('error:', error);
      this.errorSubject.next({ stream: name, error, terminal: true });
    }));
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
