import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { identifier } from 'safe-identifier';
import { proppify } from '@wonderlandlabs/propper';
import flatten from './flatten';
import {
  isArray, isString, isObject,
} from './validators';

import testPropName from './testPropertyName';
import Stream from './Stream';
import Virtual from './Virtual';
import {
  ABSENT, ID, isAbsent,
} from './absent';
import SubjectBlock from './SubjectBlock';
import uniq from './uniq';

const upperFirst = (s) => (isString(s) ? (s.substr(0, 1).toUpperCase() + s.substr(1)) : '');

// @TODO: namespace conflict between virtuals and properties.

export default class ValueStore {
  constructor(initial = {}, actions = {}, virtuals = {}) {
    this.subject.subscribe(ID, ID, () => this._closeSets());
    this._initStreams(initial);
    this._initActions(actions);
    this._initVirtuals(virtuals);
    this._listenForChange();
    this._initialized = true;
    this.broadcast();
  }

  _listenForChange() {
    combineLatest(this._blockStream, this._changeSubject)
      .pipe(
        filter(([block]) => !block),
        // eslint-disable-next-line no-unused-vars
      ).subscribe(([_, change]) => this.broadcast(change));
  }

  /**
   * triggers a data update to all subscribers
   * @returns {ValueStore}
   */
  broadcast(change) {
    if (!change || !this._memo) {
      this._memo = this.value;
    } else {
      const { name, value } = change;
      this._memo[name] = value;
    }

    this._virtuals.forEach((v, virtual) => {
      this._memo[virtual] = v.value;
    });
    this._subject.next({ ...this._memo });
  }

  _validPropNames(propNames) {
    return uniq(flatten(propNames))
      .filter((name) => (name && isString(name) && (this.streams.has(name) || this._virtuals.has(name))));
  }

  _subjectBruteForce(...propNames) {
    const { all } = this._qualfiyProps(propNames);
    return this.subject.pipe(map((result) => all.reduce((out, prop) => {
      out[prop] = result[prop];
      return out;
    }, {})),
    distinctUntilChanged());
  }

  /**
   *
   * returns a Subject made of a subset of virtuals and propNames
   * @param propNames [{string}]
   * @returns {Observable<*>}
   */
  select(...propNames) {
    const {
      virtuals, streams, expanded,
    } = this._qualifyStreamNames(propNames);

    if (this._hasOpenVirtual(virtuals)) {
      // eslint-disable-next-line max-len
      return this._subjectBruteForce(...propNames);
    }

    const metaStream = expanded.map((prop) => this.streams.get(prop).subject);
    const selectStream = combineLatest(...metaStream)
      .pipe(
        map((metaData) => {
          const returned = {};
          streams.forEach((name) => {
            returned[name] = metaData[name];
          });
          virtuals.forEach((name) => {
            returned[name] = this._virtuals.get(name).value;
          });
          return returned;
        }),
        distinctUntilChanged(),
      );

    this.subject.subscribe(ID, ID, () => {
      selectStream.complete();
    });
    return combineLatest(this._blockStream, selectStream)
      .pipe(filter(([block]) => !block),
        // eslint-disable-next-line no-unused-vars
        map(([_, value]) => value));
  }

  _qualifyStreamNamesBasic(...propNames) {
    return uniq(flatten(propNames))
      .reduce((out, name) => {
        let valid = false;
        if (this.streams.has(name)) {
          out.streams.push(name);
          valid = true;
        } else if (this._virtuals.has(name)) {
          out.virtuals.push(name);
          valid = true;
        }
        if (valid) {
          out.all.push(name);
        }
        return out;
      }, { streams: [], virtuals: [], all: [] });
  }

  _qualifyStreamNames(...propNames) {
    const props = this._qualifyStreamNamesBasic(propNames);

    // eslint-disable-next-line max-len
    props.expanded = uniq(flatten(
      props.virtuals.reduce((expanded, name) => [...expanded,
        ...this._virtuals.get(name).propNames],
      [...props.streams]),
    ));

    return props;
  }

  _subjectMetaBruteForce(...propNames) {
    const { all, virtuals } = this._validPropNames(propNames);
    return this.subjectMeta.pipe(map((result) => all.reduce((out, prop) => {
      out[prop] = result[prop];
      if (virtuals.includes(prop)) {
        out[prop] = { value: this._virtuals.get(prop).value, errors: [], notes: [] };
      }
      return out;
    }, {})),
    distinctUntilChanged());
  }

  _hasOpenVirtual(virtuals) {
    return virtuals.reduce((hov, prop) => hov || !this._virtuals.get(prop).hasProps, false);
  }

  selectMeta(...propNames) {
    const {
      virtuals, streams, expanded,
    } = this._validPropNames(propNames);

    if (this._hasOpenVirtual(virtuals)) {
      // eslint-disable-next-line max-len
      return this._subjectMetaBruteForce(...propNames);
    }

    const metaStream = expanded.map((prop) => this.streams.get(prop).metaSubject);
    const selectStream = combineLatest(metaStream)
      .pipe(
        map((metaData) => {
          Object.keys(metaData).forEach((name) => {
            if (!streams.includes(name)) {
              delete metaData[name];
            }
          });
          virtuals.forEach((name) => {
            metaData[name] = this._virtuals.get(name).meta;
          });
          return metaData;
        }),
        distinctUntilChanged(),
      );

    this.subject.subscribe(ID, ID, () => {
      selectStream.complete();
    });
    return combineLatest(this._blockStream, selectStream)
      .pipe(filter(([block]) => !block),
        // eslint-disable-next-line no-unused-vars
        map(([_, value]) => value));
  }

  get propNames() {
    return Array.from(this.streams.keys());
  }

  pre(name, pre) {
    if (isArray(name)) {
      name.forEach((n) => this.pre(n, pre));
    } else if (this.streams.has(name)) {
      this.streams.get(name).pre(pre);
    }
    return this;
  }

  post(name, post) {
    if (isArray(name)) {
      name.forEach((n) => this.post(n, post));
    } else if (this.streams.has(name)) {
      this.streams.get(name).post(post);
    }
    return this;
  }

  _initVirtuals(obj) {
    Object.keys(obj).forEach((method) => {
      this.virtual(method, ...flatten([obj[method]]));
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
    return this;
  }

  method(...args) { return this.action(...args); } // for backwards compatibility

  _initStreams(obj) {
    if (this._relay) {
      this._relay.unsubscribe();
    }

    Object.keys(obj).forEach((key) => {
      const stream = obj[key];
      if (isArray(stream)) {
        this._makeStream(key, ...stream);
      } else {
        this._makeStream(key, stream);
      }
    });

    this._updateStream();
    this._initialized = true;
  }

  virtual(name, fn, ...props) {
    const method = identifier(name);
    if (this._virtuals.has(method)) {
      throw new Error(`cannot redefine ${method}`);
    }
    this._virtuals.set(method, new Virtual(this, fn, props));
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
      const method = `set${upperFirst(identifier(name))}`;
      this._doSetters[method] = (value) => {
        try {
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
    this._virtuals.forEach(({ value }, name) => {
      out[name] = value;
    });
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
      if (this.streams.has(prop)) out[prop] = this.streams.get(prop).value;
      if (this._virtuals.has(prop)) out[prop] = this._virtuals.get(prop).value;
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

  next(obj) {
    if (!(obj && isObject(obj))) {
      throw new Error('next requires object');
    }

    const [error] = this.block(() => {
      // do a dry run - break on unacceptable values
      Object.keys(obj).forEach((key) => {
        if (this.streams.has(key)) {
          const value = obj[key];
          if (!this.streams.get(key).accepts(value)) {
            throw Object.assign(new Error(`${key} cannot accept this value`), { key, value, source: obj });
          }
        }
      });
      // then if no throw, actually set the values;
      Object.keys(obj).forEach((key) => {
        if (this.streams.has(key)) {
          this.stream.next(obj[key]);
        }
      });
    });
    if (error) throw error;
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

  _makeStream(name, value, ...params) {
    this.__propsToValue = null;
    testPropName(name);
    if (this.streams.has(name)) {
      throw new Error(`cannot redefine ${name}`);
    }

    const stream = new Stream(this, name, value, ...params);
    stream.metaSubject.subscribe(this._changeStream.next.bind(this._changeStream));
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
        this.__propsToValue[identifier(name)] = stream;
      });
    }
    return this.__propsToValue;
  }

  stream(name, value, ...filters) {
    this._makeStream(name, value, ...filters);
    this._updateStream();
    return this;
  }

  property(...args) { return this.stream(...args); }

  /**
   * executes a function, interrupting all the updates until it is done.
   * note - even if the function doesn't block, it may broadcast upon completion.
   * @param fn
   * @returns {[]}
   */
  block(fn) {
    if (!this._block) {
      this._block = new SubjectBlock();
      this._block.subject.subscribe((count) => {
        this._blockStream.next(count);
      });
    }
    return this._block.do(fn);
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
  .addProp('_changeStream', () => new Subject())
  .addProp('_subject', () => new BehaviorSubject({}))
  .addProp('_virtuals', () => new Map());
