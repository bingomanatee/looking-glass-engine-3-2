import { proppify } from '@wonderlandlabs/propper';
import lGet from 'lodash/get';
import uFirst from 'lodash/upperFirst';
import ValueStream from './ValueStream';
import {
  ABSENT, hasValue,
} from './absent';
import Message from './Message';

const hasProxy = (typeof Proxy !== 'undefined');

class ValueStore extends ValueStream {
  constructor(name, values = ABSENT, methods = ABSENT) {
    // note - stores have no initial value as such.
    super(name);
    if (hasValue(values) && typeof (values) === 'object') {
      this._initValues(values);
    }

    if (hasValue(methods) && typeof (methods) === 'object') {
      this._initMethods(methods);
    }
    this.next(this.value);
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

  /* VALUE, PROPERTY */

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
        const stream = self.streams.get(prop);
        if (!stream) {
          return undefined;
        }
        return stream.value;
      },
    });
  }

  _genValue() {
    const out = {};
    this.streams.forEach((stream) => out[stream.name] = stream.value);
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

  subscribe(onValue, ...args) {
    return super.subscribe(() => {
      onValue(this);
    }, ...args);
  }

  addStream(name, startValue = ABSENT, filter = ABSENT) {
    if (this.streams.has(name)) {
      throw new Error(`${this.name}: cannot redefine property ${name}`);
    }
    const stream = new ValueStream(name, startValue, filter);
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
    const trans = this.startTrans();
    const out = this.try(fn, ...args);
    trans.endTrans();
    return out;
  }

  try(fn, ...args) {
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
    let out;
    const trans = this.startTrans();
    let thrown = false;
    try {
      out = this.throws(fn, ...args);
    } catch (err) {
      thrown = err;
    }
    trans.endTrans();
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
    if (!this._do) {
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
        this._propSetters[tName] = (value) => {
          const out = this.throws(() => this._propSetters[name](value));
          console.log(tName, 'returned', out);
          return out;
        };
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
