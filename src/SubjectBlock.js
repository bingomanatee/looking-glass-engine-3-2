import { proppify } from '@wonderlandlabs/propper';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

class Block {
  constructor(subjectBlock) {
    this.subjectBlock = subjectBlock;
  }

  done() {
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
