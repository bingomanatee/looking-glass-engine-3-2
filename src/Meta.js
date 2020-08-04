import { proppify } from '@wonderlandlabs/propper';
import lGet from 'lodash/get';
import val from './validators';
import { ABSENT, isAbsent } from './absent';

const isFunction = val.is('function');
const isObject = val.is('object');
const isString = val.is('string');

export default class Meta {
  constructor(test, params, pOrder = ABSENT) {
    this.test = isString(test) ? val(test) : test;
    if (isString(params)) {
      this.name = params;
    } else if (isObject(params)) {
      const {
        name = '', order = 1, config,
      } = params;
      this.name = name;
      this.order = order;
      this.config = config;
    }
    if (!isAbsent(pOrder)) {
      this.order = pOrder;
    }
  }

  process(value, errors) {
    const message = this.test(value, errors, this.config);
    if (!message) return null;
    if (isString(message)) {
      return { message, name: this.name };
    }
    return message;
  }
}

Meta.isFilter = (item) => item instanceof Meta;

Meta.goodFilter = (f) => f && (
  isFunction(f)
  || (isString(f) && val.has(f))
  || Meta.isFilter(f)
);
// eslint-disable-next-line no-nested-ternary
Meta.create = (f) => {
  if (Meta.isFilter(f)) {
    return f;
  }
  let name = '';
  let test;
  if (isFunction(f)) {
    name = lGet(f, 'name', '');
    test = f;
  } else if (isString(f)) {
    if (val.has(f)) {
      test = val(f);
      name = f;
    }
  }
  return new Meta(test, { name });
};

proppify(Meta)
  .addProp('name', '', 'string')
  .addProp('config', null)
  .addProp('order', 1) // can be a number or string
  .addProp('test', () => false, 'function');
