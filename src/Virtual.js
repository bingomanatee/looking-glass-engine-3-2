import { distinctUntilChanged } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import flatten from './flatten';
import { ID } from './absent';

export default class Virtual {
  constructor(store, fn, ...propNames) {
    this.store = store;
    this.fn = fn;
    this.propNames = flatten(propNames).filter(ID);
  }

  get value() {
    const values = this.hasProps ? this.store.values(this.propNames) : {};
    return this.fn(values, this.store);
  }

  get hasProps() {
    return !!this.propNames.length;
  }
}
