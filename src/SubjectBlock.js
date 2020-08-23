import { proppify } from '@wonderlandlabs/propper';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

class Block {
  constructor(subjectBlock) {
    this.subjectBlock = subjectBlock;
  }

  add(fn) {
    this._pending.add(fn);
  }

  get _pending() {
    if (!this.__pending) {
      this.__pending = new Set();
    }
    return this.__pending;
  }

  complete() {
    if (this.__pending) {
      this._pending.forEach(() => {
        try {
          (fn) => fn();
        } catch (err) {

        }
      });
    }
    this.subjectBlock.blockDone(this);
  }
}

export default class SubjectBlock {
  block() {
    const block = new Block(this);
    this.blocks.add(block);
    this.update();
    return block;
  }

  blockDone(block) {
    this.blocks.delete(block);
    this.update();
  }

  do(fn) {
    const block = this.block();
    const out = [];
    try {
      out[1] = fn();
    } catch (err) {
      out[0] = err;
    }
    block.done();
    return out;
  }

  update() {
    this.subject.next(this.blocks.size);
  }
}
proppify(SubjectBlock)
  .addProp('subject', () => new BehaviorSubject(0)
    .pipe(distinctUntilChanged()))
  .addProp('blocks', () => new Set());
