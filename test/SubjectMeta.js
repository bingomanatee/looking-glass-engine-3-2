/* eslint-disable camelcase */

const tap = require('tap');
const p = require('../package.json');

const {SubjectMeta } = require('../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('no meta', (noMeta) => {
    const count = new SubjectMeta(1);

    const latest = { value: null, meta: null, lastValid: null };

    count.subscribe((output) => {
      Object.assign(latest, output);
    });

    noMeta.same(latest.value, 1);
    noMeta.same(latest.lastValid, 1);
    noMeta.same(latest.meta, []);

    count.next(2);

    noMeta.same(latest.value, 2);
    noMeta.same(latest.lastValid, 2);
    noMeta.same(latest.meta, []);

    count.next(3);

    noMeta.same(latest.value, 3);
    noMeta.same(latest.lastValid, 3);
    noMeta.same(latest.meta, []);

    count.complete();

    count.next(4);

    // completed streams don't emit.
    noMeta.same(latest.value, 3);
    noMeta.same(latest.lastValid, 3);
    noMeta.same(latest.meta, []);

    noMeta.end();
  });

  suite.test('meta (validator/string)', (metaString) => {
    const count = new SubjectMeta(0, 'number');

    const latest = { value: null, meta: null, lastValid: null };
    count.subscribe((output) => {
      Object.assign(latest, output);
    });

    metaString.same(latest.value, 0);
    metaString.same(latest.lastValid, 0);
    metaString.same(latest.meta, []);

    count.next(1);

    metaString.same(latest.value, 1);
    metaString.same(latest.lastValid, 1);
    metaString.same(latest.meta, []);

    count.next('two');

    metaString.same(latest.value, 'two');
    metaString.same(latest.lastValid, 1);
    metaString.same(latest.meta, [{
      level: 1,
      name: 'number',
      meta: 'number',
      message: 'must be number',
    }]);

    count.next(3);

    metaString.same(latest.value, 3);
    metaString.same(latest.lastValid, 3);

    metaString.end();
  });

  suite.end();
});
