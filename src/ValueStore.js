import { proppify } from '@wonderlandlabs/propper';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import ValueStream from './ValueStream';
import {
  ACTION_KEY_VALUE_SET, STAGE_COMPLETE, STAGE_PENDING, STAGE_PROCESS,
} from './constants';
import upperFirst from './upperFirst';
import lowerFirst from './lowerFirst';
import flatten from './flatten';
import changeIsSet from './changeIsSet';

const SET_RE = /^set([\w].*)/;

/**
 * a collective observable, blending several streams for values into a single
 * collection. this is an abstract classs that is the basis for ValueStoreMap and ValueStoreObject
 */
class ValueStore extends ValueStream {
  /**
   *
   * @param {any} initial value of the store
   * @param {Object} config tuning properties - optional
   * @param {Array} props not currently used
   */
  constructor(initial, config, ...props) {
    super(initial, config, ...props);
    this._valueToStreams(initial);
    this._watchForMapSet();
    this._watchForKeySet();
  }

  /**
   * Observe several property streams ignoring changes that come from other streams.
   * note- while the root subscxribe waits for all changes to complete/error,
   * watch gives real-time updates of value changes so may be noisier tat times.
   * @param {[function]} args onChange, onError, onComplete
   * @return {Observable}
   */
  watch(...args) {
    const names = flatten(args).filter((name) => this.streams.has(name));
    const streams = names.map((name) => {
      const stream = this.streams.get(name);
      if (stream.changeSubject) {
        return stream.changeSubject;
      }
      return stream;
    });
    return this._watchStream(names, streams);
  }

  /**
   * @param {[String]} names an array of the streams' keys
   * @param {[Observables]} Observables that emit values
   * @returns {Observable}
   * @private
   * @abstract
   */
  _watchStream(names, streams) {
    throw new Error('_watchStream must be implemented by concrete class');
  }

  /**
   * generic iterator over stored value
   * @param target {Object | Map}
   * @param fn {function}
   */
  forEach(target, fn) {
    throw new Error('must be overrirdden by implementing class');
  }

  _valueToStreams(initial) {
    this.forEach(initial, (value, name) => {
      this.createStream(name, value);
    });
  }

  _updateDoNoProxy() {
    super._updateDoNoProxy();
    this.streams.forEach((stream, name) => {
      const setKey = `set${upperFirst(name)}`;
      this.do[setKey] = (...args) => {
        this.execute(setKey, args);
      };
    });
  }

  _watchForKeySet() {
    this.on(changeIsSet, (change) => {
      const match = SET_RE.exec(change.action);
      const keyName = lowerFirst(match[1]);
      this.set(keyName, change.value[0]);
    });
  }

  /**
   * Set the value of an item in the collection
   * @param name {String} - the key for the object
   * @param value {any}
   * @return {Change}
   */
  set(name, value) {
    return this.execute(ACTION_KEY_VALUE_SET, { name, value });
  }

  _watchForMapSet() {
    // pipe all pending map sets to stream is they exist.
    this.on({ action: ACTION_KEY_VALUE_SET, stage: STAGE_PENDING }, (change) => {
      const { name, value } = change.value;
      if (this.streams.has(name)) {
        this.streams.get(name).next(value);
        change.complete();
      }
    });
    this.on({ action: ACTION_KEY_VALUE_SET, stage: STAGE_COMPLETE }, (change) => {
      const { name, value } = change.value;
      this._updateKeyValue(name, value);
    });
  }

  _updateKeyValue(name, value) {
    throw new Error('must be overridden');
  }

  /**
   * Retrives the current value of a key
   * @param {String} name
   * @return {any}
   */
  get(name) {
    throw new Error('must be overridden');
  }

  /**
   * an accessor for the values. Even if the original source is a map, it always returns an object with keys.
   * Note if proxies are available is much more efficient than `.asObject` as it Proxies to `.get`
   * instead of returning an computed object collection.
   * (If you want to access the true set of values in the stored format use `.value`
   * @returns {Object}
   */
  get my() {
    if (typeof Proxy === 'undefined') {
      return this.asObject();
    }
    if (!this._my) {
      this._my = new Proxy(this, {
        get(target, name) {
          return target.get(name);
        },
      });
    }

    return this._my;
  }

  asObject() {
    const out = {};
    this.value.forEach((value, name) => {
      try {
        out[name] = value;
      } catch (err) {

      }
    });
    return out;
  }

  /**
   * replaces the stream for a value with a custom Observable stream.
   * Useful for compounding ValueStores or inserting custom piped Observables into your store.
   * Best done before store is used
   *
   * @param {String} name
   * @param {Observable} stream
   * @returns {ValueStore} (self)
   */
  addStream(name, stream) {
    if (this.streams.has(name)) {
      this.streams.get(name).complete();
    }
    this.subSets.add(stream.subscribe((next) => {
      this._updateKeyValue(name, next);
    }));
    this.streams.set(name, stream);
    this.set(name, this.my[name]);

    return this;
  }

  /**
   * Injects a ValueStream into a stores' values allowing enhanced observation.
   * @param name
   * @param value
   * @returns {ValueStream}
   */
  createStream(name, value) {
    const stream = new BehaviorSubject(value);
    this.addStream(name, stream);
    return stream;
  }
  /**
   * The map of streams in the object.
   *
   * @name streams
   * @type {Map}
   * @readonly
   */
}

proppify(ValueStore)
  .addProp('streams', () => new Map());

export default ValueStore;
