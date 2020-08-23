/* eslint-disable camelcase */

const tap = require('tap');
const p = require('../package.json');

const { SubjectBlock } = require('../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('SubjectBlock', (sb) => {
    const blocks = [];

    const b = new SubjectBlock();
    b.subject.subscribe((c) => blocks.push(c));
    sb.same(blocks, [0]);

    const block = b.block();
    sb.same(blocks, [0, 1]);

    const block2 = b.block();
    sb.same(blocks, [0, 1, 2]);

    block.complete();
    sb.same(blocks, [0, 1, 2, 1]);
    block.complete(); // redundant - should not emit
    sb.same(blocks, [0, 1, 2, 1]);
    block2.complete();
    sb.same(blocks, [0, 1, 2, 1, 0]);

    sb.end();
  });
  suite.end();
});
