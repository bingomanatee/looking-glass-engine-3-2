import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { proppify } from '@wonderlandlabs/propper';
import flatten from './flatten';
import {
  isArray, isFunction, isObject, isString,
} from './validators';

import testPropName from './testPropertyName';
import Stream from './Stream';
import { ABSENT, ID, isAbsent } from './absent';
import SubjectBlock from './SubjectBlock';
import uniq from './uniq';
import pick from './pick';
import goodName from './goodName';

const upperFirst = (s) => (isString(s) ? (s.substr(0, 1).toUpperCase() + s.substr(1)) : '');

// @TODO: namespace conflict between virtuals and properties.

export default class ValueStore {
  constructor(initial = {}, actions = {}, virtuals = {}) {
    this.subject.subscribe(ID, ID, () => this._closeSets());
    this.addStreams(initial);
    this.addActions(actions);
    this.addVirtuals(virtuals);
    this._listenForChange();
    this._initialized = true;
    this.broadcast();
  }

  get _subject() {
    if (!this.__subject) {
      this.__subject = new BehaviorSubject(this.value);
    }
    return this.__subject;
  }

  get virtualStreams() {
    const streams = [];
    this.streams.forEach((stream) => {
      if (stream.virtual) {
        streams.push(stream);
      }
    });

    return streams;
  }

  _listenForChange() {
    combineLatest(this._blockStream, this._changeSubject)
      .pipe(
        filter(([block, change]) => {
          if (block) {
            return false;
          }
          if (change.thrown && change.thrown.length) {
            return false;
          }
          return true;
        }),
        map((_, change) => change),
        // eslint-disable-next-line no-unused-vars
      ).subscribe((change) => this.broadcast(change));
  }

  /**
   * triggers a data update to all subscribers
   */
  broadcast(change) {
    let block = null;
    if (change && change.thrown && change.thrown.length) {
      return;
    }
    this.virtualStreams.forEach((virtual) => {
      if (virtual.virtualSubjects.includes(change.name)) {
        if (!block) {
          block = this._block.block();
        }
        block.add(() => virtual.next());
      }
    });

    if (block) {
      block.complete();
    }
    this.subject.next(this.value);
  }

  _validStreamNames(propNames) {
    return uniq(flatten(propNames))
      .filter((name) => (name && isString(name) && (this.streams.has(name))));
  }

  /**
   *
   * returns a Subject made of a subset of virtuals and propNames
   * @param propNames [{string}]
   * @returns {Observable<*>}
   */
  select(...propNames) {
    const methods = this._validStreamNames(propNames);

    if (!methods.length) {
      throw new Error('select requires at least one method');
    }

    const streamSubjects = methods.map((prop) => this.streams.get(prop).subject);
    const selectStream = combineLatest(...streamSubjects)
      .pipe(
        map((values) => {
          const returned = {};
          methods.forEach((name) => {
            returned[name] = values[name];
          });
          return returned;
        }),
      );

    this.subject.subscribe(ID, ID, () => {
      selectStream.complete();
    });
    return combineLatest(this._blockStream, selectStream)
      .pipe(filter(([block]) => !block),
        // eslint-disable-next-line no-unused-vars
        map(([_, value]) => value));
  }

  selectChanges(...propNames) {
    const methods = this._validStreamNames(propNames);
    if (!methods.length) {
      throw new Error('select requires at least one method');
    }

    return this.changeSubject.pipe(
      filter((change) => methods.includes(change.name)),
    );
  }

  get propNames() {
    return Array.from(this.streams.keys());
  }

  pre(name, pre) {
    if (isArray(name)) {
      name.forEach((n) => this.pre(n, pre));
    } else if (this.streams.has(name)) {
      this.streams.get(name).pre(pre);
    } else {
      console.log('attempt to assign pre function ', pre, 'to unknown stream ', name);
    }
    return this;
  }

  post(name, post) {
    if (isArray(name)) {
      name.forEach((n) => this.post(n, post));
    } else if (this.streams.has(name)) {
      this.streams.get(name).post(post);
    } else {
      console.log('attempt to assign pre function ', post, 'to unknown stream ', name);
    }
    return this;
  }

  addVirtuals(obj) {
    Object.keys(obj).forEach((method) => {
      this.virtual(method, ...flatten([obj[method]]));
    });
  }

  addActions(obj) {
    Object.keys(obj).forEach((method) => {
      this.action(method, obj[method]);
    });
    if (this._initialized) this._redo();
    return this;
  }

  action(name, fn) {
    if (!goodName(name)) {
      throw new Error(`cannot define action with name ${name}`);
    }
    if (this._actions[name]) {
      throw new Error(`cannot redefine action ${name}`);
    }

    this._actions[name] = (...args) => fn(this, ...args);
    if (this._initialized) this._redo();
    return this;
  }

  method(...args) {
    return this.action(...args);
  } // for backwards compatibility

  addStreams(obj) {
    Object.keys(obj).forEach((key) => {
      const def = obj[key];
      if (isArray(def) && (def.length > 1 && isFunction(def[1]))) {
        this._makeStream(key, ...def);
      } else {
        this._makeStream(key, def);
      }
    });

    this._updateStream();
  }

  virtual(name, fn, ...methods) {
    if (!goodName(name)) {
      throw new Error(`cannot make virtual: bad name: ${name}`);
    }
    if (this.subjects.has(name)) {
      throw new Error(`cannot redefine stream with virtual: ${name}`);
    }

    const validStreamNames = this._validStreamNames(methods);
    const virtualStream = this.makeStream(name, pick(this.value, validStreamNames), fn);
    virtualStream.virtual = true;
    virtualStream.virtualSubjects = validStreamNames;
    return this;
  }

  _closeSets() {
    this.subSets.forEach((s) => s.unsubscribe());
    this.subSets.clear();
  }

  get _doValue() {
    return { ...this._actions, ...this._doSetters };
  }

  _redo() {
    this._doSetters = {};
    this.streams.forEach((stream, name) => {
      if (stream.virtual) {
        return;
      }
      const method = `set${upperFirst(name)}`;
      this._doSetters[method] = (value) => {
        try {
          if (stream.virtual) {
            return false;
          }
          stream.next(value);
          const { meta } = stream;
          return (meta && meta.length) ? meta : false;
        } catch (error) {
          throw Object.assign(error, {
            value, meta: stream.getMeta(value),
          });
        }
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

  get do() {
    if (this._doProxy) {
      return this._doProxy;
    }
    return { ...this._actions, ...this._doSetters };
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

  get my() {
    if (this._myProxy) {
      return this._myProxy;
    }
    return this.value;
  }

  get value() {
    const out = {};
    this.streams.forEach((stream, name) => {
      out[name] = stream.value;
    });

    return out;
  }

  get metaValue() {
    const metaData = {};
    this.streams.forEach((stream, name) => metaData[name] = stream.meta);
    this._virtuals.forEach((virtual, name) => metaData[name] = virtual.meta);
    return metaData;
  }

  values(...props) {
    return uniq(flatten(props)).reduce((out, prop) => {
      if (this.streams.has(prop)) {
        out[prop] = this.streams.get(prop).value;
      }
      if (this._virtuals.has(prop)) {
        out[prop] = this._virtuals.get(prop).value;
      }
      return out;
    }, {});
  }

  get subject() {
    return this._subject;
  }

  get metaSubject() {
    return this.subject.pipe(
      map(() => this.metaValues),
    );
  }

  subscribe(...listeners) {
    const sub = this.subject.subscribe(...listeners);
    this.subSets.add(sub);
    return sub;
  }

  _canUpdate(obj) {
    Object.keys(obj).forEach((name) => {
      if (this.streams.has(name)) {
        const value = obj[name];
        if (!this.streams.get(name).accepts(value)) {
          throw Object.assign(new Error(`${name} cannot accept this value`), { name, value, source: obj });
        }
      } else {
        console.log(`attempt to update absent name ${name}`);
      }
    });
  }

  /**
   * set several streams simultaneously.
   * @param obj
   */
  next(obj) {
    if (!(obj && isObject(obj))) {
      throw new Error('next requires object');
    }

    const [error] = this.block(() => {
      // do a dry run - break on unacceptable values
      this._canUpdate(obj);
      // then if no throw, actually set the values;
      Object.keys(obj).forEach((name) => {
        if (this.streams.has(name)) {
          this.stream.next(obj[name]);
        }
      });
    });
    if (error) {
      throw error;
    }
  }

  get subjectValue() {
    if (!this._subjectValue) {
      this._subjectValue = this.subject.pipe(
        map(() => this.value),
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
    this.subject.complete();
    this.streams.forEach((stream) => {
      stream.complete();
    });
    this._closeSets();
  }

  _makeStream(name, value, pre, post, comparator) {
    this.__propsToValue = null;
    testPropName(name);
    if (this.streams.has(name)) {
      throw new Error(`cannot redefine ${name}`);
    }

    const stream = new Stream(this, name, value, pre, post, comparator);
    const _sub = stream.changeSubject.subscribe(
      (change) => this._changeSubject.next(change),
      ID,
      () => _sub.unsubscribe(),
    );
    this.streams.set(name, stream);
  }

  get props() {
    if (this._propProxy) {
      return this._propProxy;
    }
    return this._streamsAsObject();
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

  /**
   * transform streams into an object from its orignal store, a map
   * @returns {{}}
   * @private
   */
  _streamsAsObject() {
    if (!this.__propsToValue) {
      this.__propsToValue = {};
      this.streams.forEach((stream, name) => {
        this.__propsToValue[goodName(name)] = stream;
      });
    }
    return this.__propsToValue;
  }

  stream(name, value, pre, post, compare) {
    this.makeStream(name, value, pre, post, compare);
    return this;
  }

  makeStream(name, value, pre, post, compare) {
    this._makeStream(name, value, pre, post, compare);
    this._updateStream();
    return this.streams.get(name);
  }

  property(...args) {
    return this.stream(...args);
  }

  get _block() {
    if (!this.__block) {
      this.__block = new SubjectBlock();
      this.__block.subject.subscribe((count) => {
        this.__block.next(count);
      });
    }
    return this.__block;
  }

  /**
   * executes a function, interrupting all the updates until it is complete.
   * note - even if the function doesn't block, it may broadcast upon completion.
   * @param fn
   * @returns {[]}
   */
  block(fn) {
    return this._block.do(fn);
  }

  get changeSubject() {
    return this._changeSubject;
  }

  _updateStream() {
    this._redo();
    this.broadcast();
  }
}

proppify(ValueStore)
  .addProp('subSets', () => new Set())
  .addProp('_actions', () => ({}))
  .addProp('streams', () => new Map())
  .addProp('_blockStream', () => new BehaviorSubject(0).pipe(distinctUntilChanged()))
  .addProp('_changeSubject', () => new Subject());
