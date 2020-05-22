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
          {
            value: 4,
            target: 'alpha',
            name: 'alpha',
            complete: false,
            prev: 'bob',
            trans: false,
            message: 'alpha must be a string',
            error: 'alpha must be a string',
          },
        ]);

        s.next('lisa');
        s.next(100);
        tvString.same(getErrors(), [
          {
            target: 'alpha',
            name: 'alpha',
            complete: false,
            trans: false,
            prev: 'bob',
            value: 4,
            message: 'alpha must be a string',
            error: 'alpha must be a string',
          },
          {
            target: 'alpha',
            name: 'alpha',
            complete: false,
            trans: false,
            prev: 'lisa',
            value: 100,
            message: 'alpha must be a string',
            error: 'alpha must be a string',
          },
        ]);

        tvString.same(getUpdates(), ['bob', 'lisa']);

        unsubscribe();

        tvString.end();
      });

      tv.test('negative string filter', (tvString) => {
        const s = new ValueStream('alpha', 1, ['number', '!nan']);

        const { getErrors, unsubscribe, getUpdates } = watchStream(s);

        s.next(4);
        tvString.same(getErrors(), []);
        tvString.same(getUpdates(), [1, 4]);

        s.next(Math.sqrt(-1));

        tvString.same(getErrors(), [
          {
            target: 'alpha',
            name: 'alpha',
            value: NaN,
            complete: false,
            prev: 4,
            trans: false,
            message: 'alpha cannot be a nan',
            error: 'alpha cannot be a nan',
          },
        ]);
        tvString.same(getUpdates(), [1, 4]);

        unsubscribe();

        tvString.end();
      });

      tv.test('function filter', (tvFn) => {
        const s = new ValueStream('alpha', 1, perfectSquare);

        const { getErrors, unsubscribe, getUpdates } = watchStream(s);

        s.next(5);
        tvFn.same(s.value, 1); // ignores bad data
        tvFn.same(getErrors(), [
          {
            value: 5,
            error: 'alpha must be a perfect square',
            message: 'alpha must be a perfect square',
            target: 'alpha',
            name: 'alpha',
            complete: false,
            trans: false,
            prev: 1,
          },
        ]);

        s.next(-1);
        tvFn.same(s.value, 1); // ignores bad data
        tvFn.same(getErrors(), [
          {
            target: 'alpha',
            name: 'alpha',
            complete: false,
            trans: false,
            prev: 1,
            value: 5,
            message: 'alpha must be a perfect square',
            error: 'alpha must be a perfect square',
          },
          {
            target: 'alpha',
            name: 'alpha',
            value: -1,
            complete: false,
            prev: 1,
            trans: false,
            message: 'alpha must be a whole number',
            error: 'alpha must be a whole number',
          },
        ]);

        s.next(100);
        tvFn.same(s.value, 100);

        unsubscribe();

        tvFn.end();
      });
      tv.test('array filter', (tvFn) => {
        const s = new ValueStream('alpha', 'abc', ['string', (n, errors) => {
          if (errors.length) return false;
          if (/^[a-z]+$/.test(n)) return false;
          return 'can only be lowercase characters a-z - and cannot be blank';
        }, (n, errors) => {
          if (errors.length) return false;
          return n.length > 6 ? 'must be under 6 characters' : false;
        }]);

        const { getErrors, getUpdates, unsubscribe } = watchStream(s);

        s.next('alpha');

        tvFn.same(getUpdates(), ['abc', 'alpha']); // ignores bad data
        tvFn.same(getErrors(), []);

        s.next('');

        tvFn.same(getUpdates(), ['abc', 'alpha']); // ignores bad data
        tvFn.same(getErrors(), [
          {
            target: 'alpha',
            name: 'alpha',
            value: '',
            complete: false,
            prev: 'alpha',
            trans: false,
            message: 'can only be lowercase characters a-z - and cannot be blank',
            error: 'can only be lowercase characters a-z - and cannot be blank',
          },
        ]);
        s.next('archetype');

        tvFn.same(getUpdates(), ['abc', 'alpha']); // ignores bad data
        tvFn.same(getErrors(), [
          {
            target: 'alpha',
            name: 'alpha',
            value: '',
            complete: false,
            prev: 'alpha',
            trans: false,
            message: 'can only be lowercase characters a-z - and cannot be blank',
            error: 'can only be lowercase characters a-z - and cannot be blank',
          },
          {
            target: 'alpha',
            name: 'alpha',
            value: 'archetype',
            complete: false,
            prev: 'alpha',
            trans: false,
            message: 'must be under 6 characters',
            error: 'must be under 6 characters',
          },
        ]);

        unsubscribe();

        tvFn.end();
      });

      tv.test('result of bad set', (tvFn) => {
        const s = new ValueStream('alpha', 1, ['number', '!nan']);

        tvFn.ok(!s.next(3).error);
        tvFn.ok(s.next('string').error);

        tvFn.end();
      });
      tv.end();
    });

    vs.end();
  });
  suite.end();
});
