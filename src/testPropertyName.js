import { isAbsent }               from './absent';
import val , {isString, isNumber} from './validators';

export default function testPropertyName(name, error = 'invalid property name') {
  if (!(name && isString(name)) || isNumber(name)) {
    const err = new Error(error);
    err.name = name;
    err.absent = isAbsent(name);
    throw err;
  }
}
