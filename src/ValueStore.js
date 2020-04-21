import { proppify } from '@wonderlandlabs/propper';
import is from 'is';
import ValueStream from './ValueStream';
import {
  ABSENT, hasValue, isAbsent, notAbsent,
} from './absent';

const hasProxy = (typeof Proxy !== 'undefined');

class ValueStore extends ValueStream {
  constructor(name, values) {
    // note - stores have no initial value as such.
    super(name, new Map());
    if (values && is.object(values)) {
      this._initValues(values);
    }
  }

  _initValues(values) {
    Object.keys(values).forEach((property) => {
      const definition = values[property];
      if (Array.isArray(definition)) {
        const [value, type] = definition;
        this.addStream(property, value, type);
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
   * This used to only be a quality of my; now my and value are identical.
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
    return new Proxy({}, {
      get(obj, prop) {
        console.log('======== proxy: getting ', prop, 'from ', this.name, this.streams);
        const stream = this.streams.get(prop);
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
      this.error.next({
        store: this.name,
        source: stream.name,
        error: err,
      });
    }));

    this.streams.set(property, stream);

    return this;
  }

  /* *********** METHODS *************** */

  /**
   * @param method {String}
   * @param fn {function}
   * @param bind {Boolean}
   */
  method(method, fn, bind = false) {
    if (this.methods.has(method)) {
      throw new Error(`${this.name}: cannot redefine method ${method}`);
    }
    if (bind) {
      this.methods.add(method, fn.bind(this));
    } else {
      this.methods.add(method, (...args) => method(this, ...args));
    }
  }

  get do() {
    if (hasProxy) {
      if (!this._do) {
        this._do = this._genDoProxy();
      }
      return this._do;
    }
    return this._genDo();
  }

  _virtualSetter(method) {
    const e = /^set(.)(.*)$/.exec(method);
    const name = e[1].toLowerCase() + e[2];
    if (this.streams.has(name)) {
      return (value) => this.streams.get(name).next(value);
    }
    throw new Error(`no setter for ${name}`);
  }

  _genDoProxy() {
    return new Proxy({}, {
      get(obj, method) {
        console.log('getting proxy for do:', method);
        if (!this.methods.has(method) && /^set.+/.test(method)) {
          return this._virtualSetter(method);
        }
        return this.methods.get(method);
      },
    });
  }

  _genDo() {
    const out = {};
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
