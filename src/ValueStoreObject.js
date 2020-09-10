import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import ValueStore from './ValueStore';

export default class ValueStoreObject extends ValueStore {
  forEach(target, fn) {
    Object.keys(target).forEach((name) => fn(target[name], name));
  }

  _updateKeyValue(name, value) {
    const nextObject = { ...this.value };
    nextObject[name] = value;
    return this.next(nextObject);
  }

  get(name) {
    return this.value[name];
  }

  _watchStream(names, streams) {
    return combineLatest(streams)
      .pipe(
        map((values) => {
          const m = {};
          names.forEach((name, i) => {
            m[name] = values[i];
          });
          return m;
        }),
      );
  }
}
