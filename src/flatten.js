import { isArray } from './validators';

const flatten = (...list) => {
  let out = list;
  do {
    out = out.reduce((memo, item) => (isArray(item) ? [...memo, ...item] : [...memo, item]), []);
  } while (out.some(isArray));
  return out;
};

export default (content) => {
  do {
    content = flatten(content);
  } while (content.some(isArray));
  return content;
};
