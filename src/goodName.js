import { isString } from './validators';

const NAME_RE = /^[a-z][\w]+$/;
export default function goodName(name) {
  return (isString(name) && NAME_RE.test(name));
}
