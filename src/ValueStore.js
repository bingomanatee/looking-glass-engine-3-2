import { Subject, combineLatest, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { identifier } from 'safe-identifier';
import upperFirst from 'lodash/upperFirst';
import { proppify } from '@wonderlandlabs/propper';
import val from './validators';

import testPropertyName from './testPropertyName';
import FilteredSubject from './FilteredSubject';

const isArray = val.is('array');
const isString = val.is('string');
const isNumber = val.is('number');
const isObject = val.is('object');

const NOOP = () => {};

export default class ValueStore {
  constructor(initial = {}, actions = {}) {
    this._subject = new BehaviorSubject({});
    this._subject.subscribe(NOOP, NOOP, () => this._closeSets());

    this._init(initial);
    this.actions(actions);
  }

  actions(obj) {
    Object.keys(obj).forEach((method) => {
      this.action(method, obj[method]);
    });
  }

  action(name, fn) {
    const method = identifier(name);
    if (this._actions[method]) throw new Error(`cannot redefine action ${method}`);

    this._actions[method] = (...args) => fn(this, ...args);
  }

  _init(obj) {
    if (this._relay) {
      this._relay.unsubscribe();
    }

    Object.keys(obj).forEach((key) => {
      const stream = obj[key];
      if (isArray(stream)) {
        this.property(key, ...stream);
      } else {
        this.property(key, stream);
      }
    });

    this._initDo();
    this._updateStream();
    this._initialized = true;
  }

  _closeSets() {
    this.subSets.forEach((s) => s.unsubscribe());
    this.subSets.clear();
  }

  get _doValue() {
    return { ...this._actions, ...this._doSetters };
  }

  _initDo() {
    this._actions = {};
    this._initDoSetters();
  }

  _initDoSetters() {
    this._doSetters = {};
    this.streams.forEach((stream, name) => {
      const method = `set${upperFirst(identifier(name))}`;
      this._doSetters[method] = (value) => stream.next(value);
    });

    if (typeof Proxy !== 'undefined') {
      this._doProxy = new Proxy(this, this._doHandler);
    }
  }

  get _doHandler() {
    return {
      get(store, property) {
        if (store._doSetters[property]) {
          return store._doSetters[property];
        }
        if (store._actions[property]) {
          return store._actions[property];
        }
        throw Object.assign(new Error(`attempt to call undefined action ${property}`), { store });
      },
    };
  }

  get do() {
    if (this._doProxy) return this._doProxy;
    return { ...this._actions, ...this._doSetters };
  }

  get subject() {
    return this._subject;
  }

  subscribe(...listeners) {
    const sub = this.subject.subscribe(...listeners);
    this.subSets.add(sub);
    return sub;
  }

  get subjectValue() {
    if (!this._subjectValue) {
      this._subjectValue = this.subject.pipe(
        map((values) => Array.from(Object.keys(values)).reduce((out, key) => {
          out[key] = values[key].value;
          return out;
        }, {})),
      );
    }
    return this._subjectValue;
  }

  subscribeValue(...listeners) {
    const sub = this.subjectValue
      .subscribe(...listeners);
    this.subSets.add(sub);
    return sub;
  }

  complete() {
    this.stream.complete();
    this.streams.forEach((stream) => {
      stream.complete();
    });
    this._closeSets();
  }

  property(name, value, ...filters) {
    testPropertyName(name);
    if (this.streams.has(name)) {
      throw new Error(`cannot redefine ${name}`);
    }

    const hasFilter = filters.length || (isArray(filters[0]) && filters[0].length);
    const stream = hasFilter ? new FilteredSubject(value, filters) : new BehaviorSubject(value)
      .pipe(map((value) => ({
        value,
        lastValid: value,
        meta: [],
      })));

    this.streams.set(name, stream);
    if (this._initialized) {
      this._updateStream();
    }
    return this;
  }

  _updateStream() {
    if (this._relay) {
      this._relay.unsubscribe();
    }

    const keys = Array.from(this.streams.keys());
    const values = Array.from(this.streams.values());

    this._relay = combineLatest(...values)
      .pipe(map((streamValues) => {
        const valueObj = keys.reduce((out, key, i) => {
          out[key] = streamValues[i];
          return out;
        }, {});

        // console.log('_updateStream: streamValues:', streamValues, 'valueObj:', valueObj);
        return valueObj;
      }))
      .subscribe((values) => {
        this._subject.next(values);
      }, (err) => this._subject.error(err), () => this._subject.complete());
    this._initDoSetters();
  }
}

proppify(ValueStore)
  .addProp('subSets', () => new Set())
  .addProp('streams', () => new Map());
