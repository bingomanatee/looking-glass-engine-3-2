import validators from '@wonderlandlabs/validators';

const val = validators();

export default val;

export const isFunction = val.is('function');
export const isArray = val.is('array');
export const isObject = val.is('object');
export const isString = val.is('string');
export const isNumber = val.is('number');
export const isMap = val.is('map');
export const isSet = val.is('set');
/*
import { isAbsent, hasValue, ABSENT } from './absent';

const registry = new Map();

const validators = (name, value, override = false) => {
  if (value && typeof value === 'function') {
    if (registry.has(name) && !override) {
      if (!(registry.get(name) === value)) {
        throw new Error(`cannot redefine ${name}`);
      }
    } else {
      registry.set(name, value);
    }
    return validators;
  }
  return registry.get(name);
};

validators('string', (v) => ((typeof v === 'string') ? false : 'value must be a string'));
validators('number', (v) => ((typeof v === 'number') ? false : 'value must be a number'));
validators('nan', (v) => ((typeof v !== 'number') || (Number.isNaN(v)) ? false : 'value must be not a number'));
validators('integer', (v) => ((Number.isSafeInteger(v)) ? false : 'value must be an integer'));
validators('array', (v) => (Array.isArray(v) ? false : 'value must be an array'));
// eslint-disable-next-line max-len
validators('object', (v) => (hasValue(v) && (typeof v === 'object') && (!Array.isArray(v)) ? false : 'value must be an object'));
validators('function', (v) => (v && (typeof v === 'function') ? false : 'value must be a function'));

validators.is = (test, value = ABSENT) => {
  if (isAbsent(value)) {
    return (v) => validators.is(test, v);
  }
  return !validators(test)(value);
};
export default validators;
*/
