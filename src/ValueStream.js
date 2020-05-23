import { BehaviorSubject, Subject } from 'rxjs';
import { pairwise, distinct } from 'rxjs/operators';
import { proppify } from '@wonderlandlabs/propper';
import noop from 'lodash/identity';

import {
  ABSENT, hasValue, isAbsent, notAbsent,
} from './absent';
import Message from './Message';
import Value from './Value';

/**
 * ValueStream overlays streaming changes onto Value
 * by adding a next(value) interface
 * to request that the value be changed.
 *
 * Where simply setting the value property might throw errors,
 * next both respects transactional logic
 * and routes errors into the error stream if invalid change is requested.
 *
 * syntax note: properties that self-spawn lazily are prefixed with a "$".
 * some are public (like $changes), but most part private (like _$transes).
 */

class ValueStream extends Value {
  constructor(name = ABSENT, value = ABSENT, filter = ABSENT) {
    super(name, value, filter);
  }

  /** ********************* CHANGE FLOW ********************** */

  /**
   * a read-only synchronous broadcaster of value state.
   * $changes always gets change data, regardless of transactional locking
   * @returns {Subject}
   */

  get $changes() {
    if (!this._changes) {
      this._changes = new Subject();
    }
    return this._changes;
  }

  /**
   * ordinarily you pass a single value to next --- the one you want the stream to be next.
   * However you can
   * @param params
   * @returns {*|boolean}
   */
  next(...params) {
    let msg = false;
    try {
      msg = this.makeMessage(...params);
      if (!this.isComplete) {
        this.$requests.next(msg);
      } else {
        msg.error = 'Attempt to update a completed stream';
      }
    } catch (err) {
      msg = err;
      msg.error = err.message;
    }
    return msg;
  }

  nextPromise(...params) {
    let msg;
    try {
      msg = this.next(...params);
    } catch (err) {
      msg = err;
      msg.error = err.message;
    }
    return new Promise((good, fail) => {
      if (msg.error) {
        fail(msg);
      } else {
        good(msg);
      }
    });
  }

  makeMessage(value = ABSENT, attrs = ABSENT) {
    const changeAttrs = hasValue(attrs) && typeof (attrs) === 'object' ? attrs : {};
    return new Message(value, { ...changeAttrs, name: this.name, target: this });
  }

  get $requests() {
    if (!this.__requests) {
      this.__requests = new Subject();
      this.subSet.add(this.__requests.subscribe(this._onRequest.bind(this),
        (err) => {
          console.log('request submission error:', err);
        }));
    }
    return this.__requests;
  }

  /**
   * satisfy a request message: either set the value OR say why we did not.
   * @param msg {Message}
   * @private
   */

  _onRequest(msg) {
    if (msg.complete || isAbsent(msg.value)) {
      return msg;
    }

    msg.prev = this.value;
    if (msg.trans) {
      msg.startTrans();
    }

    try {
      this._setValue(msg.value);
    } catch ({ message, error }) {
      msg.error = error || message;
      this.errors.next(msg);
    }
    if (!msg.error) {
      // this alerts watchers to synchromous updating.
      // transactional locks are ignored.
      this.$changes.next(msg);
    } else {
      if (msg.trans) {
        msg.endTrans();
      }
      return msg;
    }

    if (!this.hasTranses) {
      // alerts watchers that a value has updated UNLESS there are transactional locks.
      this._broadcastChange(msg);
    } else {
      // note that when transactions are closed an update needs next be sent.
      this.pendingChanges = true;
    }

    if (msg.trans) {
      msg.endTrans();
    }
    return msg;
  }

  /**
   * sends a signal next any subscribers that the value has been changed.
   *
   * @param msg {Message} -- note this is not a significant value because
   *                         subscribers listen next the value, not the message;
   *                         might be useful for tracking.
   * @private
   */
  _broadcastChange(msg) {
    this._$updater.next(msg);
  }

  /**
   * a stream that expresses any errors; generally validation failures but
   * also any other trapped errors in the system.
   * @returns {Observable<unknown>}
   */
  get errors() {
    if (!this._errors) {
      this._errors = new Subject().pipe(distinct());
    }
    return this._errors;
  }

  /** *************** TRANSACTIONALITY *************** */

  get hasTranses() {
    if (!this._transes) {
      return false;
    }
    return this._transes.size;
  }

  /**
   *
   * @returns {Set}
   * @private
   */
  get _$transes() {
    if (!this.hasTranses) {
      this._transes = new Set();
    }
    return this._transes;
  }

  startTrans(msg) {
    if (!msg) {
      msg = this.makeMessage(ABSENT, { trans: true });
    }
    this._$transes.add(msg);
    this._broadcastTrans();
    return msg;
  }

  endTrans(msg) {
    if (!this._$transes.has(msg)) {
      return;
    }
    this._$transes.delete(msg);
    this._broadcastTrans();
  }

  _broadcastTrans() {
    this._$transStream.next(this._$transes.size);
  }

  get _$transStream() {
    if (!this.__transStream) {
      this.__transStream = new BehaviorSubject(this._$transes.size);
      this.subSet.add(this.__transStream.pipe(pairwise()).subscribe(([a, b]) => {
        if (this.pendingChanges && (a && (!b))) {
          this.pendingChanges = false;
          this._broadcastChange();
        }
      }));
    }
    return this.__transStream;
  }

  /** ******************* SUBSCRIPTION ************* */

  get _$updater() {
    if (!this.__updater) {
      this.__updater = new BehaviorSubject(this);
    }
    return this.__updater;
  }

  subscribe(onUpdate = noop, onError = noop, onComplete = noop) {
    if (onError) {
      this.subSet.add(this.errors.subscribe(onError, onError));
    }
    const sub = this._$updater.subscribe(
      () => {
        onUpdate(this);
      },
      onError,
      onComplete,
    );

    this.subSet.add(sub);
    return sub;
  }

  get isComplete() {
    return !!this._completed;
  }

  complete() {
    this._completed = true;
    try {
      const subs = Array.from(this.subSet);
      subs.forEach((sub) => {
        sub.unsubscribe();
        this.subSet.delete(sub);
      });
    } catch (err) {
      console.log('complete error: ', err);
    }
  }
}

proppify(ValueStream)
  .addProp('pendingChanges', false, 'boolean')
  .addProp('subSet', () => new Set()); // a collection of subscriptions to cancel when the valueStream is cancelled.

export default ValueStream;
