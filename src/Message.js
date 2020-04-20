import lodashGet from 'lodash/get';
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
      console.log('message has no target: ,', this);
    }
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
