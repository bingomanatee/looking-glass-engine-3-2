import { BehaviorSubject, Subject, combineLatest } from 'rxjs';
import { proppify } from '@wonderlandlabs/propper';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { isArray, isFunction, isObject } from './validators';
import Stream from './Stream';
import { ABSENT, ID } from './absent';
import Change from './Change';
import Base from './Base';
import upperFirst from './upperFirst';
import lowerFirst from './lowerFirst';

// @TODO: namespace conflict between virtuals and properties.
const SET_RE = /^set(.+)$/i;

export default class ValueStore extends Base {
  constructor(initial = {}, actions = {}) {
    super();
    this._blockCountStream = new BehaviorSubject(0);
    this.addStreams(initial);
    this.addActions(actions);
  }

  addActions(obj) {
    if (!isObject(obj)) throw new Error('non-obj set to addActions');

    Object.keys(obj).forEach((name) => {
      this.actions.set(name, (...args) => obj[name](this, ...args));
    });
  }

  block(fn) {

  }

  get subjectChoked() {
    if (!this.__subjectChoked) {
      this.__subjectChoked = combineLatest(
        this._pendingCountSubject, super.subject,
      )
        .pipe(
          filter(([b]) => !b),
          // eslint-disable-next-line no-unused-vars
          map(([_, c]) => c),
          distinctUntilChanged(),
        );
    }
    return this.__subjectChoked;
  }

  addStreams(obj) {
    if (!isObject(obj)) throw new Error('non-obj set to addStreams');

    Object.keys(obj).forEach((name) => {
      const value = obj[name];
      if (Array.isArray(value) && isFunction(value[1])) {
        this._makeStream(name, ...value);
      } else {
        this._makeStream(name, value);
      }
    });

    this.next();
    return this;
  }

  _makeStream(name, value, pre = ID) {
    this.streams.set(name, new Stream(this, name, value, pre));
    delete this._do;
  }

  property(...args) {
    return this.stream(...args);
  }

  stream(name, value, pre) {
    this._makeStream(name, value, pre);
    this.next();
    return this;
  }

  subscribe(...methods) {
    const sub = this.subjectChoked.subscribe(...methods);
    this.subSets.add(sub);
    return sub;
  }

  complete() {
    this.subject.complete();
    this.streams.forEach((s) => s.complete());
    super.complete();
  }

  next(change) {
    if (change) {
      this._pending.add(change);
      if (change instanceof Change) {
        if (change.thrown) return;
      }
      this._update(change);
    }
    this.broadcast();
  }

  updateStream(name, value) {
    if (this.streams.has(name)) {
      try {
        this.streams.get(name).next(value);
      } catch (err) {
        return err;
      }
    } else if (SET_RE.test(name)) {
      const subName = name.match(SET_RE)[1];
      return this.updateStream(lowerFirst(subName), value);
    } else {
      const lower = lowerFirst(name);
      if (this.stream.has(lower)) {
        return this.updateStream(name, lower, value);
      }
    }
    return false;
  }

  _getDo() {
    const out = {};
    this.streams.keys().forEach((name) => {
      out[`set${upperFirst(name)}`] = (value) => this.updateStream(name, value);
    });
    return out;
  }

  virtual(name, fn, ...dependants) {
    const fields = flatten(dependants);
    let stream;
    const recompute = () => {
      try {
        return fn(this.values(fields), this);
      } catch (err) {
        const change = new Change(stream, ABSENT);
        change.thrown = err;
        change.thrownAt = 'virtual';
        err.change = change;
        this.next(change);
      }
    };
    stream = new BehaviorSubject(recompute())
      .pipe(map(recompute),
        distinctUntilChanged());
    this.streams.set(name, stream);
    this.changes.subscribe((change) => {
      if (change instanceof Change) {
        if (fields.include(change.name)) {
          stream.next();
        }
      }
    });
  }

  _doProxy() {
    return new Proxy(this, {
      get(valueStore, name) {
        return (value) => valueStore.updateStream(name, value);
      },
    });
  }

  get do() {
    if (!this._do) {
      if (typeof Proxy === 'undefined') {
        if (!this._do) {
          this._do = this._getDo();
        }
      } else {
        this._do = this._doProxy();
      }
    }
    return this._do;
  }

  broadcast() {
    const v = this.values();
    this.subject.next(v);
  }

  _update(change) {
    this._push(change);
    this.changes.next(change);
    this._pop(change);
  }

  _pop(item) {
    this._pending.delete(item);
    this._pendingCountSubject.next(this._pending.size);
  }

  _push(item) {
    this._pending.add(item);
    this._pendingCountSubject.next(this._pending.size);
  }

  get value() {
    return this.subject.value;
  }

  values(qualifier = null) {
    const out = {};
    this.streams.forEach((stream, name) => {
      if (isArray(qualifier)) {
        if (!qualifier.includes(name)) {
          return;
        }
      }
      if (isFunction(qualifier)) {
        if (!qualifier(stream, name)) {
          return;
        }
      }
      out[name] = stream.value;
    });
    return out;
  }
}

proppify(ValueStore)
  .addProp('actions', () => (new Map()))
  .addProp('changes', new Subject())
  .addProp('_pending', () => (new Set()))
  .addProp('_pendingCountSubject',
    () => new BehaviorSubject(0).pipe(
      map((a) => (a === 0 ? 0 : 1)),
      distinctUntilChanged(),
    ))
  .addProp('streams', () => (new Map()));
