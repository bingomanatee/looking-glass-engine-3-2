import { isString } from './validators';

const upperFirst = (s) => {
  if (!isString(s)) {
    return '';
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default upperFirst;
