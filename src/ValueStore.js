import { proppify } from '@wonderlandlabs/propper';
import ValueStream from './ValueStream';
import { ABSENT, isAbsent } from './absent';
import {
  ACTION_MAP_SET, STAGE_COMPLETE, STAGE_PENDING, STAGE_PROCESS,
} from './constants';
import upperFirst from './upperFirst';
import asMap from './asMap';
import { isArray, isString } from './validators';
import lowerFirst from './lowerFirst';

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
  constructor(initial, ...props) {
    super(new Map(), ...props);
    this._valueToStreams(initial);
    this._watchForMapSet();
    this._watchForKeySet();
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

  _watchForMapSet() {
    this.on({ action: ACTION_MAP_SET, stage: STAGE_COMPLETE }, (change) => {
      const { name, value } = change.value;
      this._setKeyValue(name, value);
    });
  }

  _setKeyValue(name, value) {
    if (this.streams.has(name)) {
      this.streams.get(name).next(value);
    } else if (this.value.has(name)) {
      this._update(name, value);
    }
  }

  _watchForKeySet() {
    this.on(changeIsSet, (change) => {
      const match = SET_RE.exec(change.action);
      const keyName = lowerFirst(match[1]);
      this._setKeyValue(keyName, change.value[0]);
    });
  }

  _update(name, value) {
    const nextMap = new Map(this.value);
    nextMap.set(name, value);
    return this.next(nextMap);
  }

  set(name, value) {
    if (this.streams.has(name)) {
      this.streams.get(name).next(value);
    }
    this.execute(ACTION_MAP_SET, { name, value }, [STAGE_PROCESS, STAGE_PENDING]);
  }

  get(name) {
    return this.value.get(name);
  }

  get my() {
    if (typeof Proxy === 'undefined') {
      return this.asObject();
    }
    if (!this._my) {
      this._my = Proxy({
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
    this._update(name, stream.value);
    this.streams.set(name, stream);

    return this;
  }

  createStream(name, value) {
    const stream = new ValueStream(value);
    this.addStream(name, stream);
    return this;
  }
}

proppify(ValueStore)
  .addProp('streams', () => new Map());
