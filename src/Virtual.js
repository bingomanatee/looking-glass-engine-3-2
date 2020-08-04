import flatten from './flatten';
import { distinctUntilChanged } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';

export default class Virtual {
  constructor(store, fn, ...fields) {
    this.store = store;
    this.fn = fn;
    this.fields = flatten(fields);
  }

  get value() {
    return this.fn(this.store.values(this.fields), this.store);
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
