import { isObject } from './validators';

const asMap = (initial) => {
  if (initial instanceof Map) return initial;
  if (initial && isObject(initial)) {
    const map = new Map();
    Object.keys(initial).forEach((name) => map.set(name, initial[name]));
    return map;
  }
  return new Map();
};

export default asMap;
