import { proppify } from '@wonderlandlabs/propper';
import { BehaviorSubject, combineLatest, distinctUntilChanged } from 'rxjs';
import { map } from 'rxjs/operators';
import isEqual from 'lodash.isequal';
import ValueStream from './ValueStream';

import { ABSENT, ID, isAbsent } from './absent';
import {
  ACTION_MAP_SET, ACTION_NEXT, STAGE_BEGIN, STAGE_COMPLETE, STAGE_PENDING, STAGE_PROCESS,
} from './constants';
import upperFirst from './upperFirst';
import asMap from './asMap';
import { isArray, isString } from './validators';
import lowerFirst from './lowerFirst';
import flatten from './flatten';
import uniq from './uniq';

const SET_RE = /^set([\w].*)/;

const changeIsSet = (change, store) => {
  if (change.stage !== STAGE_PROCESS) return false;
  if (store.actions.has(change.action)) {
    return false;
  }
  if (!isString(change.action)) return false;
  const find = SET_RE.test(change.action);
  return find;
};

export default class ValueStore extends ValueStream {
  constructor(initial, config, ...props) {
    super(asMap(initial), config, ...props);
    this._valueToStreams(initial);
    this._watchForMapSet();
    this._watchForKeySet();
  }

  watch(...args) {
    const names = flatten(args).filter((name) => this.streams.has(name));
    const streams = names.map((name) => this.streams.get(name));
    return combineLatest(streams)
      .pipe(
        map((values) => {
          const m = new Map();
          names.forEach((name, i) => {
            m.set(name, values[i]);
          });
          return m;
        }),
      );
  }

  filterStream(name, fn) {
    this.streams.get(name).filter(fn);
    return this;
  }

  _valueToStreams(initial) {
    asMap(initial).forEach((value, name) => {
      this.createStream(name, value);
    });
  }

  _updateDoNoProxy() {
    super._updateDoNoProxy();
    this.streams.forEach((stream, name) => {
      const setKey = `set${upperFirst(name)}`;
      this.do[setKey] = (...args) => {
        this.execute(setKey, args);
      };
    });
  }

  _watchForKeySet() {
    this.on(changeIsSet, (change) => {
      const match = SET_RE.exec(change.action);
      const keyName = lowerFirst(match[1]);
      this.set(keyName, change.value[0]);
    });
  }

  set(name, value) {
    this.execute(ACTION_MAP_SET, { name, value }, [STAGE_PROCESS, STAGE_PENDING]);
  }

  _watchForMapSet() {
    // pipe all pending map sets to stream is they exist.
    this.on({ action: ACTION_MAP_SET, stage: STAGE_PENDING }, (change) => {
      const { name, value } = change.value;
      if (this.streams.has(name)) {
        this.streams.get(name).next(value);
        change.complete();
      }
    });
    this.on({ action: ACTION_MAP_SET, stage: STAGE_COMPLETE }, (change) => {
      const { name, value } = change.value;
      this._update(name, value);
    });
  }

  _update(name, value) {
    const nextMap = new Map(this.value);
    nextMap.set(name, value);
    return this.next(nextMap);
  }

  get(name) {
    return this.value.get(name);
  }

  get my() {
    if (typeof Proxy === 'undefined') {
      return this.asObject();
    }
    if (!this._my) {
      this._my = new Proxy(this,{
        get(target, name) {
          return target.get(name);
        },
      });
    }

    return this._my;
  }

  asObject() {
    const out = {};
    this.value.forEach((value, name) => {
      try {
        out[name] = value;
      } catch (err) {

      }
    });
    return out;
  }

  addStream(name, stream) {
    if (this.streams.has(name)) {
      this.streams.get(name).complete();
    }
    this.subSets.add(stream.subscribe((next) => {
      this._update(name, next);
    }));
    this.streams.set(name, stream);
    this.set(name, this.my[name]);

    return this;
  }

  createStream(name, value) {
    const stream = new BehaviorSubject(value);
    this.addStream(name, stream);
    return this;
  }
}

proppify(ValueStore)
  .addProp('streams', () => new Map());
