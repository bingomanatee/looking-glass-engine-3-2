import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import ValueStore from './ValueStore';
import asMap from './asMap';

export default class ValueStoreObject extends ValueStore {
  constructor(initial, config) {
    super(asMap(initial), config);
  }

  forEach(target, fn) {
    target.forEach(fn);
  }

  _updateKeyValue(name, value) {
    const nextMap = new Map(this.value);
    nextMap.set(name, value);
    return this.next(nextMap);
  }

  get(name) {
    return this.value.get(name);
  }

  _watchStream(names, streams) {
    return combineLatest(streams)
      .pipe(
        map((values) => {
          const m = new Map();
          names.forEach((name, i) => {
            m.set(name, values[i]);
          });
          return m;
        }),
      );
  }
}
