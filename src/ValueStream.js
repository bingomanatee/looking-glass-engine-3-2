import { identifier } from 'safe-identifier';
import { BehaviorSubject, Subject } from 'rxjs';
import { pairwise, map } from 'rxjs/operators';
import { proppify } from '@wonderlandlabs/propper';

import noop from 'lodash/identity';
import is from 'is';
import first from 'lodash/first';
import { ABSENT, has, notAbsent } from './absent';
import testVSName from './testVSName';
import Message from './Message';

/**
 * syntax note: properties that self-spawn laziy are prefixed with a "$".
 * some are public (like $changes), but most pare private (like _$transes).
 */

class ValueStream {
  constructor(name = ABSENT, value = ABSENT) {
    this.name = name;
    if (notAbsent(value)) {
      this._$value = value;
    }
  }

  /** *********************** IDENTITY  ****************** */

  get name() {
    return this._name;
  }

  set name(name) {
    testVSName(name, 'cannot initialize ValueStream with bad name');
    this._name = name;
  }

  get value() {
    return this.serialize();
  }

  /**
   * a private setter for value.
   * @param item
   * @private
   */
  set _$value(item) {
    this._value = item;
  }

  /**
   * the error data for a prospective value - or the current one if called without parameters
   * @param value
   * @returns null || an Exception for bad values
   */
  valueErrors(value = ABSENT) {
    if (notAbsent(value)) {
      // @TODO: test
      return null;
    }
    return this.valueErrors(this.value);
  }

  get hasChildren() {
    return !!this._children;
  }

  hasValidName() {
    return this.name === identifier(this.name);
  }

  /**
   * the public face of children; a map, if they have been added
   * @returns {Map|Map<any, any>|null}
   */
  get children() {
    if (!this.hasChildren) {
      return null;
    }
    return this._children;
  }

  /**
   * an internal utility that creates a _children map if necessary
   * @returns {Map}
   * @private
   */
  get _$children() {
    if (!this.hasChildren) {
      this._children = new Map();
    }
    return this._children;
  }

  /**
   * note - this is not to be called directly-it is a child call of property();
   *
   * @param name
   * @param value
   * @private
   */
  _add(name, value) {
    testVSName(name, `Cannot add a child to valueStream ${this.name}-invalid name`);
    let childValue = value;

    if (this.has(name)) {
      throw new Error(`cannot redefine ${name} of ValueStream ${this.name}`);
    }

    if (!(childValue instanceof ValueStream)) {
      childValue = new ValueStream(name, value);
    }
    childValue.parent = this;

    this._$children.set(name, childValue);
  }

  has(name) {
    if (!this.hasChildren) {
      return false;
    }
    return this._children.has(name);
  }

  serialize() {
    if (!this.hasChildren) {
      // @TODO: allow for more advanced serialization
      return this._value;
    }
    const out = {};
    this._children.forEach((stream, name) => {
      if (!stream.hasValidName()) {
        const validName = identifier(name);
        out[validName] = { [name]: stream.serialize() };
      } else {
        out[name] = stream.serialize();
      }
    });
    return out;
  }

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

  /** ********************* CHANGE FLOW ********************** */

  /*
   * queues a change for execution.
   * Should execute synchronously.
   *
   * Must be externally flushed to complete trans.
   * @param value
   * @param attrs {Object}
   * @returns {Message}
   */

  to(value = ABSENT, attrs = ABSENT) {
    const msg = this.makeMessage(value, attrs);
    this._$requests.next(msg);
    return msg;
  }

  makeMessage(value, attrs = ABSENT) {
    const changeAttrs = notAbsent(attrs) && is.object(attrs) ? attrs : {};
    return new Message(value, { ...changeAttrs, name: this.name, target: this });
  }

  get _$requests() {
    if (!this.__requests) {
      this.__requests = new Subject();
      this.subSet.add(this.__requests.subscribe(this._onRequest.bind(this), (err) => {
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
    if (msg.complete) {
      console.log('attempt to re-process a complete message', msg);
      return;
    }

    msg.prev = this.value;
    msg.error = this.valueErrors(msg.value) || msg.error;
    msg.complete = true;

    if (msg.error) {
      this.errors.next(msg);
      return;
    }

    // actually makes the action to execute. impervious to transations.
    if (notAbsent(msg.value)) {
      this._$value = msg.value;
      this.$changes.next(msg);
    }

    // alerts any watchers that there HAS BEEN action taken.
    if (!this.hasTranses) {
      this._broadcastChange(msg);
    } else {
      // note that when transactions are closed an update needs to be sent.
      this.pendingChanges = true;
    }
  }

  /**
   * sends a signal to any subscribers that the value has been changed.
   *
   * @param msg {Message} -- note this is not a significant value because
   *                         subscribers listen to the value, not the message;
   *                         might be useful for tracking.
   * @private
   */
  _broadcastChange(msg) {
    this._$updater.next(msg);
  }

  get errors() {
    if (!this._errors) {
      this._errors = new Subject();
    }
    return this._errors;
  }

  /** *************** TRANSACTIONALITY *************** */

  get hasTranses() {
    return !!this._transes;
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


  startTrans() {
    const msg = this.makeMessage(ABSENT, { trans: true });
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
        if (this.pendingChanges && a && (!b)) {
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
      () => {
        if (is.function(onComplete)) {
          onComplete();
        }
      },
    );

    this.subSet.add(sub);
    return sub;
  }

  complete() {
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
  .addProp('subSet', () => new Set());

export default ValueStream;
