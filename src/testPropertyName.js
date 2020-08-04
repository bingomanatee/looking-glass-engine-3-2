import { isAbsent } from './absent';
import val from './validators';

const isString = val.is('string');
const isNumber = val.is('number');
export default function testPropertyName(name, error = 'invalid property name') {
  if (!(name && isString(name)) || isNumber(name)) {
    const err = new Error(error);
    err.name = name;
    err.absent = isAbsent(name);
    throw err;
  }
}
