/* eslint-disable camelcase */
const tap = require('tap');
const is = require('is');
const p = require('../../package.json');
const watchStream = require('../../testUtils/watchStream');

const { ValueStream } = require('../../lib');

const perfectSquare = (value, out, stream) => {
  if (value < 0) {
    return `${stream.name} must be a whole number`;
  }
  if (!is.int(Math.sqrt(value))) {
    return `${stream.name} must be a perfect square`;
  }
  return false;
};

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStream', (vs) => {
    vs.test('filter', (tv) => {
      tv.test('string filter', (tvString) => {
        const s = new ValueStream('alpha', 'bob', 'string');

        const { getErrors, unsubscribe, getUpdates } = watchStream(s);

        s.next(4);
        tvString.same(s.value, 'bob'); // ignores bad data

        tvString.same(getErrors(), [
          { value: 4, error: 'alpha must be a string' },
        ]);

        s.next('lisa');
        s.next(100);
        tvString.same(getErrors(), [
          { value: 4, error: 'alpha must be a string' },
          { value: 100, error: 'alpha must be a string' },
        ]);

        tvString.same(getUpdates(), ['bob', 'lisa']);

        unsubscribe();

        tvString.end();
      });

      tv.test('function filter', (tvFn) => {
        const s = new ValueStream('alpha', 1, perfectSquare);

        const { getErrors, unsubscribe, getUpdates } = watchStream(s);

        s.next(5);
        tvFn.same(s.value, 1); // ignores bad data
        tvFn.same(getErrors(), [
          { value: 5, error: 'alpha must be a perfect square' },
        ]);

        s.next(-1);
        tvFn.same(s.value, 1); // ignores bad data
        tvFn.same(getErrors(), [
          { value: 5, error: 'alpha must be a perfect square' },
          { value: -1, error: 'alpha must be a whole number' },
        ]);

        s.next(100);
        tvFn.same(s.value, 100);

        unsubscribe();

        tvFn.end();
      });

      tv.end();
    });

    vs.end();
  });
  suite.end();
});
