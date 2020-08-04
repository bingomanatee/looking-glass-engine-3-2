import flatten from 'lodash/flattenDeep';

export default class Virtual {
  constructor(store, fn, ...fields) {
    this.store = store;
    this.fn = fn;
    this.fields = flatten(fields);
  }

  get value() {
    return this.fn(this.store.values(this.fields), this.store);
  }
}
