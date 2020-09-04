import ValueStream from './ValueStream';
import { ABSENT, isAbsent } from './absent';
import {
  STAGE_PROCESS, STAGE_PENDING, ACTION_MAP_SET, STAGE_COMPLETE,
} from './constants';
import { isObject } from './validators';

const _asMap = (initial) => {
  if (initial instanceof Map) return initial;
  if (initial && isObject(initial)) {
    const map = new Map();
    Object.keys(initial).forEach((name) => map.set(name, initial[name]));
    return map;
  }
  return new Map();
};

export default class ValueStore extends ValueStream {
  constructor(initial, ...props) {
    super(_asMap(initial), ...props);
    this._watchForMapSet();
  }

  _watchForMapSet() {
    this.on({ action: ACTION_MAP_SET, stage: STAGE_COMPLETE }, (change) => {
      const { name, value } = change.value;
      if (this.streams.has(name)) {
        this.streams.next(value);
      } else {
        this._update(name, value);
      }
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
