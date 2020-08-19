import { isArray } from './validators';

export default (list) => (isArray(list) ? list.reduce((o, item) => (o.includes(item) ? o : [...o, item]), []) : []);
