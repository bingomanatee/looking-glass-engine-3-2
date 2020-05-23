import { has, notAbsent } from './absent';

export default function testVSName(name, error = 'invalid ValueStream name') {
  if (!(name && has(name) && (typeof name === 'string' || typeof name === 'number'))) {
    const err = new Error(error);
    if (notAbsent(name)) {
      err.name = name;
    } else {
      err.name = undefined;
    }
    throw err;
  }
}
