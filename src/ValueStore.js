import { proppify } from '@wonderlandlabs/propper';
import is from 'is';
import lGet from 'lodash/get';
import uFirst from 'lodash/upperFirst';
import { isReference } from 'rollup-plugin-commonjs/src/ast-utils';
import ValueStream from './ValueStream';
import {
  ABSENT, has, hasValue, isAbsent, notAbsent,
} from './absent';

import Message from './Message';

const hasProxy = (typeof Proxy !== 'undefined');

class ValueStore extends ValueStream {
  constructor(name, values = ABSENT, methods = ABSENT) {
    // note - stores have no initial value as such.
    super(name, new Map());
    if (hasValue(values) && is.object(values)) {
      this._initValues(values);
    }

    if (hasValue(methods) && is.object(methods)) {
      this._initMethods(methods);
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

  property(...params) {
    return this.addStream(...params);
  }

  addStream(property, startValue = ABSENT, filter = ABSENT) {
    if (this.streams.has(property)) {
      throw new Error(`${this.name}: cannot redefine property ${property}`);
    }
    const stream = new ValueStream(property, startValue, filter);
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

    this.streams.set(property, stream);
    delete this._propSetters;
    if (!hasProxy) {
      delete this._do;
    }
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
    let bind = false;
    let trans = false;
    let throwable = false;
    if (hasValue(options) && is.object(options)) {
      bind = lGet(options, 'bind', false);
      trans = lGet(options, 'trans', false);
      throwable = lGet(options, 'throw', false);
    }

    if (this.methods.has(method)) {
      throw new Error(`${this.name}: cannot redefine method ${method}`);
    }
    const methodFn = bind ? fn.bind(this) : (...args) => fn(this, ...args);
    if (throwable) {
      // eslint-disable-next-line max-len
      this.methods.set(method, (...args) => (trans ? this.throwTrans(methodFn, ...args) : this.throwable(methodFn, ...args)));
    } else {
      this.methods.set(method, (...args) => (trans ? this.tryTrans(methodFn, ...args) : this.try(methodFn, ...args)));
    }
    return this;
  }

  tryTrans(fn, ...args) {
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
  throwable(fn, ...args) {
    let thrownFromSub = false;
    const s = this.subscribe(() => {
    }, (err) => {
      thrownFromSub = err;
      throw err;
    });

    try {
      const out = fn(...args);
      s.unsubscribe();
      return out;
    } catch (interrupt) {
      s.unsubscribe();
      if (interrupt !== thrownFromSub) {
        // an error happened that was NOT trapped and rethrown by/from the error stream
        this.errors.next(interrupt);
      }
      throw interrupt;
    }
  }

  throwTrans(fn, ...args) {
    let thrown = false;
    const trans = this.startTrans();
    const s = this.subscribe(() => {
    }, (err) => {
      thrown = err;
      throw err;
    });
    const startValue = this.value;

    try {
      const out = fn(...args);
      s.unsubscribe();
      trans.endTrans();
      return out;
    } catch (interrupt) {
      s.unsubscribe();
      trans.endTrans();
      if (interrupt !== thrown) {
        // an error happened that was NOT trapped by the error stream
        this.errors.next(interrupt);
      }
      throw interrupt;
    }
  }

  /**
   * do or do not --- there is no try!
   * @returns {Object|Proxy}
   */
  get do() {
    if (!this._do) {
      console.log('hasProxy', hasProxy);
      if (hasProxy) {
        this._do = this._genDoProxy();
      } else {
        this._do = this._genDo();
      }
      console.log('set _do as  -- ', this._do);
    }
    return this._do;
  }

  get propSetters() {
    if (!this._propSetters) {
      this._propSetters = {};
      this.streams.forEach((stream) => {
        const name = `set${uFirst(stream.name)}`;
        this.propSetters[name] = (value) => this.try(() => stream.next(value));
      });
    }
    return this._propSetters;
  }

  _genDoProxy() {
    const self = this;
    return new Proxy({}, {
      get(obj, method) {
        if (self.propSetters[method]) {
          return self.propSetters[method];
        }
        return self.methods.get(method);
      },
    });
  }

  _genDo() {
    const out = { ...this.propSetters };
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
