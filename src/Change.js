import { proppify } from '@wonderlandlabs/propper';
import { nanoid }               from 'nanoid';
import { ABSENT, ID, isAbsent } from './absent';
import flatten                  from './flatten';
import { isArray } from './validators';
import pick from './pick';

export default class Change {
  constructor(stream, next, last = ABSENT) {
    this.value = next;
    this.nextValue = next;
    this.lastValue = isAbsent(last) ? stream.value : last;
    this.stream = stream;
    this.id = `change_${nanoid()}`;
  }

  get redundant() {
    return !this.stream._compare(this.stream.value, this.nextValue);
  }

  get name() {
    return this.stream.name;
  }

  toJSON(id) {
    const out = {
      id: id || this.id,
      value: this.value,
      lastValue: this.lastValue,
    };

    if (!isAbsent(this.nextValue)) {
      out.nextValue = this.nextValue;
    }
    if (!isAbsent(this.lastValue)) {
      out.lastValue = this.lastValue;
    }
    if (this.thrown) {
      out.thrown = this.thrown.message ? this.thrown.message : this.thrown;
      out.thrownAt = this.thrownAt;
    }
    if (this.stream.errors.length) out.errors = [...this.stream.errors];
    if ((this.stream.notes && !isArray(this.stream.notes)) || (isArray(this.stream.notes) && this.stream.notes.length)) out.notes = this.stream.notes;
    return out;
  }

  get thrownString() {
    return this.thrown.reduce((s, e) => [...s, e.message], [])
      .join(',');
  }
}

proppify(Change)
  .addProp('stream')
  .addProp('value')
  .addProp('thrown')
  .addProp('thrownAt', '', 'string')
  .addProp('nextValue', ABSENT)
  .addProp('lastValue')
  .addProp('notes');
