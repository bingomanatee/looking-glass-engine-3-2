import { Subject, combineLatest, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { identifier } from 'safe-identifier';
import { proppify } from '@wonderlandlabs/propper';
import flatten from './flatten';
import val, { isArray, isFunction, isString } from './validators';

import testPropName from './testPropertyName';
import SubjectMeta from './SubjectMeta';
import Virtual from './Virtual';
import {
  NOOP_SUBJECT, NOOP, ABSENT, isAbsent,
} from './absent';

const uniq = (list) => (isArray(list) ? list.reduce((o, item) => (o.includes(item) ? o : [...o, item]), []) : []);
const upperFirst = (s) => (isString(s) ? (s.substr(0, 1).toUpperCase() + s.substr(1)) : '');

// @TODO: namespace conflict between virtuals and properties.

export default class ValueStore {
  constructor(initial = {}, actions = {}, virtuals = {}) {
    this._subject = new BehaviorSubject({});
    this._subject.subscribe(NOOP, NOOP, () => this._closeSets());

    this._initStreams(initial);
    this._initActions(actions);
    this._initVirtuals(virtuals);
  }

  select(...fields) {
    const properties = uniq(flatten(fields));

    const streams = properties.map((prop) => {
      if (this.streams.has(prop)) return this.streams.get(prop).subject;
      if (this._virtuals.has(prop)) return this._virtuals.get(prop).subject;
      return NOOP_SUBJECT;
    });
    const selectStream = combineLatest(streams)
      .pipe(
        distinctUntilChanged(),
        map((values) => properties.reduce((out, prop, i) => {
          out[prop] = values[i];
          return out;
        }, {})),
      );

    this.subject.subscribe(NOOP, NOOP, () => selectStream.complete());
    return selectStream;
  }

  get propNames() {
    return Array.from(this.streams.keys());
  }

  preProcess(name, fn) {
    if (!name) {
      this.propNames.forEach((n) => this.preProcess(n));
      return this;
    }
    if (isFunction(name)) {
      fn = name;
      name = this.propNames.pop();
    }
    if (!this.streams.has(name)) {
      throw new Error(`preProcess cannot find prop ${name}`);
    }
    this.streams.get(name).preProcess(fn);
    return this;
  }

  selectValues(...fields) {
    const properties = uniq(flatten(fields));
    const virtuals = [];

    const streams = properties.map((prop) => {
      if (this.streams.has(prop)) return this.streams.get(prop).subject;
      if (this._virtuals.has(prop)) {
        virtuals.push(prop);
      }
      return NOOP_SUBJECT;
    });
    const selectStream = combineLatest(streams)
      .pipe(
        distinctUntilChanged(),
        map((values) => properties.reduce((out, prop, i) => {
          out[prop] = virtuals.includes(prop) ? this._virtuals.get(prop).value : values[i].value;
          return out;
        }, {})),
      );

    this.subject.subscribe(NOOP, NOOP, () => selectStream.complete());
    return selectStream;
  }

  _initVirtuals(obj) {
    Object.keys(obj).forEach((method) => {
      this.virtual(method, ...flatten(obj[method]));
    });
  }

  _initActions(obj) {
    Object.keys(obj).forEach((method) => {
      this.action(method, obj[method]);
    });
    return this;
  }

  action(name, fn) {
    const method = identifier(name);
    if (this._actions[method]) throw new Error(`cannot redefine action ${method}`);

    this._actions[method] = (...args) => fn(this, ...args);
  }

  _initStreams(obj) {
    if (this._relay) {
      this._relay.unsubscribe();
    }

    Object.keys(obj).forEach((key) => {
      const stream = obj[key];
      if (isArray(stream)) {
        this._makeProp(key, ...stream);
      } else {
        this._makeProp(key, stream);
      }
    });

    this._updateStream();
    this._initialized = true;
  }

  virtual(name, fn, ...fields) {
    const method = identifier(name);
    if (this._virtuals.has(method)) {
      throw new Error(`cannot redefine ${method}`);
    }
    this._virtuals.set(method, new Virtual(this, fn, fields));
    return this;
  }

  _closeSets() {
    this.subSets.forEach((s) => s.unsubscribe());
    this.subSets.clear();
  }

  get _doValue() {
    return { ...this._actions, ...this._doSetters };
  }

  _initDo() {
    this._doSetters = {};
    this.streams.forEach((stream, name) => {
      const method = `set${upperFirst(identifier(name))}`;
      this._doSetters[method] = (value) => {
        stream.next(value);
        const { meta } = stream;
        if (meta.length) return meta;
        return false;
      };
    });
  }

  get _doHandler() {
    return {
      get(store, prop) {
        if (store._doSetters[prop]) {
          return store._doSetters[prop];
        }
        if (store._actions[prop]) {
          return store._actions[prop];
        }
        throw Object.assign(new Error(`attempt to call undefined action ${prop}`), { store });
      },
    };
  }

  get _doProxy() {
    if (!this.__doProxy) {
      if (typeof Proxy !== 'undefined') {
        this.__doProxy = new Proxy(this, this._doHandler);
      } else {
        this.__doProxy = ABSENT;
      }
    }
    return isAbsent(this.__doProxy) ? false : this.__doProxy;
  }

  get _myHandler() {
    return {
      get(store, prop) {
        if (store.streams.has(prop)) {
          return store.streams.get(prop).value;
        }
        if (store._virtuals.has(prop)) {
          return store._virtuals.get(prop).value;
        }
        throw Object.assign(new Error(`attempt to call undefined prop ${prop}`), { store });
      },
    };
  }

  get _myProxy() {
    if (!this.__myProxy) {
      if (typeof Proxy !== 'undefined') {
        this.__myProxy = new Proxy(this, this._myHandler);
      } else {
        this.__myProxy = ABSENT;
      }
    }
    return isAbsent(this.__myProxy) ? false : this.__myProxy;
  }

  get do() {
    if (this._doProxy) return this._doProxy;
    return { ...this._actions, ...this._doSetters };
  }

  get my() {
    if (this._myProxy) return this._myProxy;
    return this.value;
  }

  get value() {
    const out = {};
    this._virtuals.forEach((virtual, name) => {
      out[name] = virtual.value;
    });
    this.streams.forEach((stream, name) => {
      out[name] = stream.value;
    });

    return out;
  }

  values(...fields) {
    return flatten(fields).reduce((out, field) => {
      out[field] = this.streams.has(field) ? this.streams.get(field).value : null;
      return out;
    }, {});
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

  _makeProp(name, value, ...filters) {
    this._propsToValue = null;
    testPropName(name);
    if (this.streams.has(name)) {
      throw new Error(`cannot redefine ${name}`);
    }

    const stream = new SubjectMeta(value, filters);
    stream.store = this;
    stream.name = name;

    this.streams.set(name, stream);
  }

  get props() {
    if (this._propProxy) {
      return this._propProxy;
    }
    return this._propsToValue();
  }

  get _propProxy() {
    if (!this.__propProxy) {
      if (typeof Proxy !== 'undefined') {
        this.__propProxy = new Proxy(this, {
          get(store, prop) {
            return store.streams.get(prop);
          },
        });
      } else {
        this.__propProxy = ABSENT;
      }
    }
    const out = isAbsent(this.__propProxy) ? false : this.__propProxy;
    return out;
  }

  _propsToValue() {
    if (!this.__propsToValue) {
      this.__propsToValue = {};
      this.streams.forEach((stream, name) => {
        this.__propsToValue[identifier(name)] = stream;
      });
    }
    return this.__propsToValue;
  }

  prop(name, value, ...filters) {
    this._makeProp(name, value, ...filters);
    if (this._initialized) {
      this._updateStream();
    }
    return this;
  }

  _updateStream() {
    if (this._relay) {
      this._relay.complete();
    }

    const keys = Array.from(this.streams.keys());
    const values = Array.from(this.streams.values()).map((v) => v.subject);

    this._relay = combineLatest(...values)
      .pipe(map((streamValues) => {
        const valueObj = keys.reduce((out, key, i) => {
          out[key] = streamValues[i];
          return out;
        }, {});

        return valueObj;
      }))
      .subscribe((currentValues) => {
        this._subject.next(currentValues);
      }, (err) => this._subject.error(err), () => this._subject.complete());
    this._initDo();
  }
}

proppify(ValueStore)
  .addProp('subSets', () => new Set())
  .addProp('_actions', () => ({}))
  .addProp('streams', () => new Map())
  .addProp('_virtuals', () => new Map());
