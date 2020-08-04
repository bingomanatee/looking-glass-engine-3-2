/* eslint-disable camelcase */

const tap = require('tap');
const p = require('../package.json');

const { FilteredSubject } = require('../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('unfiltered value', (unfiltered) => {
    const count = new FilteredSubject(1);

    const latest = { value: null, meta: null, lastValid: null };

    count.subscribe((output) => {
      Object.assign(latest, output);
    });

    unfiltered.same(latest.value, 1);
    unfiltered.same(latest.lastValid, 1);
    unfiltered.same(latest.meta, []);

    count.next(2);

    unfiltered.same(latest.value, 2);
    unfiltered.same(latest.lastValid, 2);
    unfiltered.same(latest.meta, []);

    count.next(3);

    unfiltered.same(latest.value, 3);
    unfiltered.same(latest.lastValid, 3);
    unfiltered.same(latest.meta, []);

    count.complete();

    count.next(4);

    // completed streams don't emit.
    unfiltered.same(latest.value, 3);
    unfiltered.same(latest.lastValid, 3);
    unfiltered.same(latest.meta, []);

    unfiltered.end();
  });

  suite.test('filtered value (validator/string)', (filtered) => {
    const count = new FilteredSubject(0, 'number');

    const latest = { value: null, meta: null, lastValid: null };
    count.subscribe((output) => {
      Object.assign(latest, output);
    });

    filtered.same(latest.value, 0);
    filtered.same(latest.lastValid, 0);
    filtered.same(latest.meta, []);

    count.next(1);

    filtered.same(latest.value, 1);
    filtered.same(latest.lastValid, 1);
    filtered.same(latest.meta, []);

    count.next('two');

    filtered.same(latest.value, 'two');
    filtered.same(latest.lastValid, 1);
    filtered.same(latest.meta, [{
      level: 1,
      name: 'number',
      meta: 'number',
      message: 'must be number',
    }]);

    count.next(3);

    filtered.same(latest.value, 3);
    filtered.same(latest.lastValid, 3);

    filtered.end();
  });

  suite.end();
});
