function makePop(valueStream) {
  if (!valueStream.actions.has('pop')) {
    valueStream.actions.set('pop', (stream) => {
      const [removed] = stream.do.splice(-1, 1);
      return removed;
    });
  }
}

function makeShift(valueStream) {
  if (!valueStream.actions.has('shift')) {
    valueStream.actions.set('shift', (stream) => {
      const [removed] = stream.do.splice(0, 1);
      return removed;
    });
  }
}

function makeSplice(valueStream) {
  if (!valueStream.actions.has('splice')) {
    valueStream.actions.set('splice', (stream, start, count, ...added) => {
      const target = [...stream.value];

      let onChanged = null;

      const spliced = target.splice(start, count, ...added);
      onChanged = valueStream.next(target);
      if (onChanged.hasError) {
        return onChanged;
      }

      return spliced;
    });
  }
}

function makePush(valueStream) {
  if (!valueStream.actions.has('push')) {
    valueStream.actions.set('push', (stream, value) => stream.do.splice(this.value.length, 0, value));
  }
}
function makeUnshift(valueStream) {
  if (!valueStream.actions.has('unshift')) {
    valueStream.actions.set('unshift', (stream, value) => stream.do.splice(0, 0, value));
  }
}

export default function streamArray(valueStream) {
  makeSplice(valueStream);
  makePop(valueStream);
  makePush(valueStream);
  makeShift(valueStream);
  makeUnshift(valueStream);
}
