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
    if (!this.propNames.length) {
      return this.fn({}, this.store);
    }
    return this.fn(this.store.values(this.propNames), this.store);
  }

  _makeSubject() {
    const subject = new BehaviorSubject(this.value);
    this.store.subscribe(() => subject.next(this.value));
    return subject.pipe(distinctUntilChanged());
  }

  get subject() {
    if (!this._subject) {
      this._subject = this._makeSubject();
    }
    return this._subject;
  }
}
