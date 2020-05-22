import lodashGet from 'lodash/get';
import pick from 'lodash/pick';

import { proppify } from '@wonderlandlabs/propper';
import { notAbsent, has, ABSENT } from './absent';

export default class Message {
  constructor(value, props = ABSENT) {
    this.value = value;
    if (!has(props)) {
      return;
    }

    if (typeof props.name === 'string') this.name = props.name;
    this.trans = !!props.trans;
    this.prev = props.prev;
    this.error = props.error;
    this.target = props.target;
  }

  endTrans() {
    if (this.target) {
      this.target.endTrans(this);
    } else {
      console.warn('message has no target: ,', this);
    }
  }

  get message() {
    if (!this.error) return '';

    if (typeof this.error === 'string') {
      return this.error;
    }

    if (typeof this.error === 'object') {
      if (this.error.error && typeof this.error.error === 'string') {
        return this.error.error;
      }
    }

    return '';
  }

  toJSON() {
    const err = pick(this, 'target,name,value,complete,prev,trans,error'.split(','));
    err.message = this.message;
    if (typeof err.target === 'object' && err.target.name) err.target = err.target.name;
    return err;
  }
}

proppify(Message)
  .addProp('target', null)
  .addProp('name', '')
  .addProp('value', null)
  .addProp('complete', false)
  .addProp('prev', ABSENT)
  .addProp('trans', false, 'boolean')
  .addProp('error', null);
