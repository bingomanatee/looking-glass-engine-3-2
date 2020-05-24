import { proppify } from '@wonderlandlabs/propper';
import { map, distinctUntilChanged } from 'rxjs/operators';
import lGet from 'lodash/get';
import flattenDeep from 'lodash/flattenDeep';
import uFirst from 'lodash/upperFirst';
import stringify from 'json-stringify-safe';
import { BehaviorSubject } from 'rxjs';
import ValueStream from './ValueStream';
import validators from './validators';
import { ABSENT } from './absent';
import Message from './Message';

const hasProxy = (typeof Proxy !== 'undefined');

class ValueStore extends ValueStream {
  constructor(name, values = ABSENT, methods = ABSENT, virtuals = ABSENT) {
    // note - stores have no initial value as such.
    super(name);
    if (validators.is('object', values)) {
      this._initValues(values);
    }

    if (validators.is('object', methods)) {
      this._initMethods(methods);
    }

    if (validators.is('object', virtuals)) {
      this._initVirtuals(virtuals);
    }
    this.next(this.value);
  }

  _initVirtuals(virtuals) {
    Object.keys(virtuals).forEach((name) => {
      const fn = virtuals[name];
      this.addVirtual(name, fn);
    });
  }

  addVirtual(name, fn, redefine = false) {
    try {
      if (!validators.is('function', fn)) {
        throw new Error('non-function supplied as virtual value');
      }
      if ((!redefine) && this._$virtuals.has(name)) {
        throw new Error(`cannot redefine ${name}`);
      }
      this._$virtuals.set(name, (...args) => this.derive(fn, name, ...args));
    } catch (err) {
      console.error('error defining virtual:', name, fn, redefine, err);
    }
  }

  _findSV(fields) {
    const streams = [];
    const virtuals = [];
    flattenDeep(fields).forEach((name) => {
      if (!name) {
        return;
      }
      if (this.streams.has(name)) {
        streams.push(name);
      } else if (this._$virtuals.has(name)) {
        virtuals.push(name);
      }
    });
    return { streams, virtuals };
  }

  _expressor(streams, virtuals) {
    return () => {
      try {
        const data = virtuals.length ? this.deriveAll(virtuals) : new Map();
        streams.forEach((s) => data.set(s, this.my[s]));
        const out = {};
        data.forEach((value, key) => {
          out[key] = value;
        });
        return out;
      } catch (err) {
        console.error('error expressing watched data:', err);
        return {};
      }
    };
  }

  /**
   * informs the observer if a set of fields/virtuals change.
   *
   * @param onChange {function} | {[function, function, function]} gets (values: Object, self) when values change
   * @param serializer {function}  | {string} (first field reduces fields to a scalar type for comparison
   * @param fields {[String]} the properties/virtuals you want to observe
   * @returns {Subscription}
   */
  watch(onChange, serializer, ...fields) {
    try {
      if (!validators.is('function', onChange)) {
        throw new Error('first argument to watch must be a function');
      }
      if (!validators.is('function', serializer)) {
        fields.unshift(serializer);
        serializer = stringify;
      }

      const { streams, virtuals } = this._findSV(fields);

      // create a function that expressed the desired subset of data
      const expressData = this._expressor(streams, virtuals);

      // create a stream with the initial values,
      // that updates with every change
      const stream = new BehaviorSubject(expressData());

      // update with expressedData every time the data changes.
      // note -- IGNORES transactional locking.

      const changeSub = this.$changes.pipe(
        map(expressData),
      ).subscribe((data) => stream.next(data));

      this.subSet.add(changeSub);

      // watch distinct expressions of data
      const sub = stream.pipe(
        distinctUntilChanged((a, b) => a === b, (v) => serializer(v)),
      ).subscribe((data) => {
        onChange(data, this);
      });

      this.subSet.add(sub);

      return sub;
    } catch (err) {
      console.error('error in watch: ', err);
      return null;
    }
  }

  _initMethods(methods) {
    Object.keys(methods).forEach((methodName) => {
      const definition = methods[methodName];
      if (Array.isArray(definition)) {
        this.addMethod(methodName, ...definition);
      } else {
        this.addMethod(methodName, definition);
      }
    });
  }

  _initValues(values) {
    Object.keys(values).forEach((property) => {
      const definition = values[property];
      if (Array.isArray(definition)) {
        this.addStream(property, ...definition);
      } else {
        this.addStream(property, definition);
      }
    });
  }

  setFilter(property, filter) {
    this.streams[property].filter = filter;
    return this;
  }

  _updateStreamValue(name, value) {
    this.streams.get(name).next(value);
  }

  /* ====================== VIRTUALS ===================== */

  get _$virtuals() {
    if (!this._virtuals) {
      this._virtuals = new Map();
    }
    return this._virtuals;
  }

  get hasVirtuals() {
    return this._virtuals && this._$virtuals.size;
  }

  hasVirtual(name) {
    if (!this.hasVirtuals) {
      return false;
    }
    return this._$virtuals.has(name);
  }

  /**
   * returns a value from the store.
   * given that this is intended to be non-invasive to the store
   * derive will throw an error if any attempts are made to change the store
   * (i.e., any messages are generated) during the execution of the function.
   * @param fn {function}
   * @param name {String}
   * @param args {Array}
   */
  derive(fn, name, ...args) {
    if (!validators.is('function', fn)) {
      throw new Error('derive requires a function');
    }
    const msg = this.makeMessage({ name, fn }, { virtual: true, blocker: true });
    // prevent circularity
    const circular = this._getBlocker(name);

    if (circular) {
      msg.error = { error: 'circular virtual', circular };
      throw msg;
    }

    this.block(msg);
    const out = this._try(fn, this, ...args);
    this.unblock(msg);

    return out;
  }

  _getBlocker(name) {
    let blocker = false;
    if (this.hasBlockers) {
      this._$blockers.forEach((msg) => {
        if (!blocker && msg.virtual && msg.name === name) {
          blocker = msg;
        }
      });
    }
    return blocker;
  }

  /**
   *
   * @returns {Map}
   */
  deriveAll(keys = ABSENT) {
    const registry = new Map();
    this._$virtuals.forEach((fn, name) => {
      if (Array.isArray(keys) && !keys.includes(name)) {
        return;
      }
      registry.set(name, this._try(fn, this));
    });

    return registry;
  }

  /* ==================== VALUE, PROPERTY ================ */

  /**
   * the Value of the ValueStore is the summation of its' streams.
   * the value get return is optimized as a proxy to those pairs expressed as an object.
   */

  get value() {
    return this._genValue();
  }

  get my() {
    if (hasProxy) {
      if (!this._valueProxy) {
        this._valueProxy = this._genValueProxy();
      }
      return this._valueProxy;
    }
    return this._genValue();
  }

  _genValueProxy() {
    const self = this;
    return new Proxy({}, {
      get(obj, prop) {
        if (self.streams.has(prop)) {
          const stream = self.streams.get(prop);
          return stream.value;
        }
        if (self.hasVirtuals) {
          if (self._$virtuals.has(prop)) {
            return self._$virtuals.get(prop)();
          }
        }
        return undefined;
      },
    });
  }

  _genValue() {
    const out = {};
    this.streams.forEach((stream) => {
      out[stream.name] = stream.value;
    });
    if (!this.hasBlockers) {
      const virtuals = this.deriveAll();
      virtuals.forEach((value, name) => {
        try {
          if (!out.hasOwnProperty(name)) {
            out[name] = value;
          }
        } catch (err) {
          console.error('cannot attach virtual - conflicts with existing stream', name);
        }
      });
    }
    return out;
  }

  clearCache() {
    delete this._valueProxy;
    delete this._do;
    delete this._propSetters;
  }

  property(...params) {
    return this.addStream(...params);
  }

  get $updateStream() {
    return super.$updateStream.pipe(map(() => this));
  }

  addStream(name, startValue = ABSENT, filter = ABSENT) {
    if (this.streams.has(name)) {
      throw new Error(`${this.name}: cannot redefine property ${name}`);
    }
    const stream = new ValueStream(name, startValue, filter);
    stream.parent = this;

    this.subSet.add(stream.subscribe(() => {
      this.next(this.value);
    }, (err) => {
      if (err instanceof Message) {
        err = err.toJSON();
      }
      this.errors.next({
        store: this.name,
        source: stream.name,
        error: err,
      });
    }));

    this.streams.set(name, stream);
    delete this._propSetters;

    this.clearCache();
    return this;
  }

  /* *********** METHODS *************** */

  method(...params) {
    return this.addMethod(...params);
  }

  /**
   * @param method {String}
   * @param fn {function}
   * @param bind {Object}
   */
  addMethod(method, fn, options = ABSENT) {
    const bind = lGet(options, 'bind', false);
    const trans = lGet(options, 'trans', false);
    const throws = lGet(options, 'throws', false);

    if (this.methods.has(method)) {
      throw new Error(`${this.name}: cannot redefine method ${method}`);
    }
    const methodFn = bind ? fn.bind(this) : (...args) => fn(this, ...args);
    if (throws) {
      // eslint-disable-next-line max-len
      this.methods.set(method, (...args) => (trans ? this.throwTrans(methodFn, ...args) : this.throws(methodFn, ...args)));
    } else {
      this.methods.set(method, (...args) => (trans ? this._tryTrans(methodFn, ...args) : this.try(methodFn, ...args)));
    }
    this.clearCache();
    return this;
  }

  _tryTrans(fn, ...args) {
    if (this.hasBlockers) {
      throw new Error('cannot execute methods while blocked');
    }
    const trans = this.startTrans();
    const out = this.try(fn, ...args);
    this.endTrans(trans);
    return out;
  }

  try(fn, ...args) {
    if (this.hasBlockers) {
      throw new Error('cannot execute methods while blocked');
    }
    return this._try(fn, ...args);
  }

  _try(fn, ...args) {
    let out;
    try {
      out = fn(...args);
    } catch (err) {
      this.errors.next(err);
    }
    return out;
  }

  /**
   * this method undoes the error trapping of ValueStore;
   * it interrupts the flow of a method if any errors are detected in the error stream,
   * and throws that error (or any other thrown error)
   *
   * @param fn
   * @param args
   * @returns {*}
   */
  throws(fn, ...args) {
    if (this.hasBlockers) {
      throw new Error('cannot execute methods while blocked');
    }
    let thrown = false;
    let out;
    let s = this.subscribe(() => {
    }, (err) => {
      thrown = err;
    });

    try {
      out = fn(...args);
    } catch (interrupt) {
      s.unsubscribe();
      s = null;
      if (interrupt !== thrown) {
        // an error happened that was NOT trapped and rethrown by/from the error stream
        this.errors.next(interrupt);
        thrown = interrupt;
      }
    }
    if (s) {
      s.unsubscribe();
    }
    if (thrown) {
      throw thrown;
    }
    return out;
  }

  throwTrans(fn, ...args) {
    if (this.hasBlockers) {
      throw new Error('cannot execute methods while blocked');
    }
    let out;
    const trans = this.startTrans();
    let thrown = false;
    try {
      out = this.throws(fn, ...args);
    } catch (err) {
      thrown = err;
    }
    this.endTrans(trans);
    if (thrown) {
      throw thrown;
    }
    return out;
  }

  /**
   * do or do not --- there is no try!
   * @returns {Object|Proxy}
   */
  get do() {
    if (
      !this._do
    ) {
      if (hasProxy) {
        this._do = this._genDoProxy();
      } else {
        this._do = this._genDo();
      }
    }
    return this._do;
  }

  get _$propSetters() {
    if (!this._propSetters) {
      this._propSetters = {};
      this.streams.forEach((stream) => {
        const name = `set${uFirst(stream.name)}`;
        this._propSetters[name] = (value) => stream.next(value);
        const tName = `${name}_ot`;
        this._propSetters[tName] = (value) => this.throws(() => this._propSetters[name](value));
      });
    }
    return this._propSetters;
  }

  _genDoProxy() {
    const self = this;
    return new Proxy({}, {
      get(obj, method) {
        if (self._$propSetters[method]) {
          return self._$propSetters[method];
        }
        return self.methods.get(method);
      },
    });
  }

  _genDo() {
    const out = { ...this._$propSetters };
    this.methods.forEach((method, name) => {
      out[name] = method;
    });
    return out;
  }
}

proppify(ValueStore)
  .addProp('methods', () => new Map())
  .addProp('streams', () => new Map());

export default ValueStore;
