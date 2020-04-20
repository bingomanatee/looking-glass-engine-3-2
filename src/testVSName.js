import is from 'is';
import { has, notAbsent } from './absent';

export default function testVSName(name, error = 'invalid ValueStream name') {
  if (!(name && has(name) && (is.string(name) || is.number(name)))) {
    const err = new Error(error);
    if (notAbsent(name)) {
      err.name = name;
    } else {
      err.name = undefined;
    }
    throw err;
  }
}
