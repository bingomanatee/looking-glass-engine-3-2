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
  console.log('changeIsSet: ', change.action, find);
  return find;
};

export default class ValueStore extends ValueStream {
  constructor(initial, ...props) {
    super(asMap(initial), ...props);
    this._watchForMapSet();
    this._watchForKeySet();
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
      this.streams.next(value);
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

  addStream(name, value = ABSENT, stream = null) {
    if (this.streams.has(name)) {
      throw new Error(`cannot redefine stream ${name}`);
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
      this._update(name, next);
    }));

    return this;
  }
}

proppify(ValueStore)
  .addProp('streams', () => new Map());
