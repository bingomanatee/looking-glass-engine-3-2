import { proppify } from '@wonderlandlabs/propper';
import uniq from './uniq';
import { ABSENT, ID } from './absent';
import flatten from './flatten';
import { isArray } from './validators';

export default class Change {
  constructor(stream, next) {
    this.value = stream.value;
    this.stream = stream;
    this.next = next;
  }

  toJSON() {
    return {
      name: this.stream.name,
      value: this.value,
      next: this.next,
      nextValue: this.nextValue,
      errors: this.errors,
      notes: this.notes,
      thrown: this.thrown,
    };
  }

  pre() {
    try {
      const value = this.stream.getPre(this.next);
      this.nextValue = value;
    } catch (error) {
      this.thrown.push({ at: 'pre', error });
    }
  }

  post() {
    try {
      const { errors, notes } = this.stream.getPost(this.next);
      if (isArray(errors)) this.errors = uniq([...this.errors, ...errors]).filter(ID);
      this.notes = notes;
    } catch (error) {
      this.thrown.push({ at: 'post', error });
    }
  }
}

proppify(Change)
  .addProp('stream')
  .addProp('value')
  .addProp('virtual', false)
  .addProp('virtualSubjects', [], 'array')
  .addProp('next')
  .addProp('nextValue', ABSENT)
  .addProp('errors', () => ([]), 'array')
  .addProp('thrown', () => ([]), 'array')
  .addProp('notes');
