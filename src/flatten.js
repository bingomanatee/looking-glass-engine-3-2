import { isArray } from './validators';

const flatten = (list) => list.reduce((out, item) => (isArray(item) ? [...out, ...item] : [...out, item]), []);

export default (content) => {
  do {
    content = flatten(content);
  } while (content.some(isArray));
  return content;
};
