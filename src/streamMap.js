import {
  STAGE_PENDING, STAGE_PROCESS, ACTION_KEY_VALUE_SET,
} from './constants';

function makeSet(valueStream) {
  if (!valueStream.actions.has('set')) {
    valueStream.actions.set('set', (stream, key, value) => {
      if (stream.streams.has(key)) {
        return stream.streams.get(key).next(value);
      }
      const change = this.execute({ key, value }, ACTION_KEY_VALUE_SET, [
        STAGE_PROCESS, STAGE_PENDING,
      ]);

      if (change.hasError) {
        return change;
      }
      const next = new Map(this.value);
      next.set(key, change.value.value);
      return stream.next(next);
    });
  }
}

export default function streamArray(valueStream) {
  makeSet(valueStream);
}
