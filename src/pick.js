import { isObject } from './validators';
import flatten from './flatten';

export default function pick(value, methods) {
  if (!isObject(value)) {
    return {};
  }
  return flatten(methods).reduce((target, name) => {
    target[name] = value[name];
    return target;
  }, {});
}
