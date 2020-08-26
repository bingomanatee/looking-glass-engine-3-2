import { BehaviorSubject } from 'rxjs';
import { proppify } from '@wonderlandlabs/propper';
import { isAbsent, ABSENT } from './absent';

const _id = () => {
  const s = (`${Math.random()} ${Date.now()}`).replace(/[\D]/g, '');
  let out = '';
  s.split('').forEach((c) => {
    Math.random() > 0.5 ? out += c : out = c + out;
    if (!(out.length % 4)) out += '-';
  });
  return out;
};
class Base {
  constructor(initial = ABSENT) {
    this.id = _id();
    if (!isAbsent(initial)) {
      this.subject.next(initial);
    }
  }

  complete() {
    this.subSets.forEach((s) => s.complete());
    this.subSets.clear();
    this.done = true;
  }
}

proppify(Base)
  .addProp('subject', () => new BehaviorSubject(null))
  .addProp('subSets', () => new Set())
  .addProp('done', false, 'boolean');

export default Base;
