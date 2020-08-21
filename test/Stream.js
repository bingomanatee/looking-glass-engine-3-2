/* eslint-disable camelcase */

const tap = require('tap');
const p = require('../package.json');

const { Stream, ABSENT } = require('../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('no pre/post', (noPrePost) => {
    noPrePost.test('subscribe', (sub) => {
      const count = new Stream({}, 'count', 1);

      let latest = null;
      const history = [];
      count.subscribe((output) => {
        latest = output;
        history.push(output);
      }, (err) => {
        console.log('error in subscribe: ', err);
      });

      sub.same(latest, 1);
      sub.same(count.value, 1);
      sub.same(history, [1]);

      count.next(2);
      sub.same(count.value, 2);
      sub.same(history, [1, 2]);

      count.next(3);
      sub.same(count.value, 3);
      sub.same(history, [1, 2, 3]);

      sub.same(latest, 3);
      sub.same(count.value, 3);
      sub.same(history, [1, 2, 3]);

      count.complete();

      count.next(4);

      // completed streams don't emit.
      sub.same(latest, 3);
      sub.same(history, [1, 2, 3]);

      sub.end();
    });
    noPrePost.test('changeSubject', (sub) => {
      const count = new Stream({}, 'count', 1);

      let latestChange = null;

      count.changeSubject.subscribe(
        (output) => {
          latestChange = output;
        },
        (err) => console.error('meta subject error:', err),
      );

      count.next(2);

      sub.same(latestChange.nextValue, 2);
      sub.same(latestChange.notes, null);
      sub.same(latestChange.errors, []);
      sub.same(count.value, 2);

      count.next(3);

      sub.same(latestChange.nextValue, 3);
      sub.same(latestChange.notes, null);
      sub.same(latestChange.errors, []);
      sub.same(count.value, 3);

      count.complete();

      count.next(4);

      // completed streams don't emit.
      sub.same(latestChange.nextValue, 3);
      sub.same(latestChange.notes, null);
      sub.same(latestChange.errors, []);
      sub.same(count.value, 3);

      sub.end();
    });
    noPrePost.end();
  });

  suite.test('preFilter', (preFilter) => {
    preFilter.test('number floor', (sub) => {
      const count = new Stream({}, 'count', 1, (n) => {
        if (typeof (n) === 'number') return Math.floor(n);
        throw new Error('not a number');
      });

      let latest = null;
      const history = [];
      count.subscribe((output) => {
        latest = output;
        history.push(output);
      }, (err) => {
        console.log('error in subscribe: ', err);
      });

      sub.same(latest, 1);
      sub.same(history, [1]);
      sub.same(count.value, 1);

      count.next(1.1);

      sub.same(latest, 1);
      sub.same(history, [1]);

      count.next(2);
      sub.same(history, [1, 2]);
      sub.same(count.value, 2);

      count.next(3);
      count.next(3);
      sub.same(latest, 3);
      sub.same(history, [1, 2, 3]);
      sub.same(count.value, 3);

      sub.same(latest, 3);
      sub.same(history, [1, 2, 3]);

      count.complete();

      // completed streams don't emit.
      count.next(4);
      sub.same(count.value, 3);
      sub.same(latest, 3);
      sub.same(history, [1, 2, 3]);

      sub.end();
    });
    preFilter.test('subscribeMeta', (sub) => {
      const count = new Stream({}, 'count', 1, (n) => {
        if (typeof (n) === 'number') return Math.floor(n);
        throw new Error('not a number');
      });

      let latest = null;
      const history = [];

      count.subscribe(value => history.push(value));
      count.changeSubject.subscribe((output) => {
        latest = output;
      }, (err) => console.error('meta subject error:', err),
      () => console.log('---- done'));

      sub.same(history, [1]);

      count.next(2);

      sub.same(latest.nextValue, 2);
      sub.same(latest.errors, []);
      sub.same(latest.thrown, []);
      sub.same(latest.notes, null);
      sub.same(history, [1, 2]);

      count.next(3);

      sub.same(latest.nextValue, 3);
      sub.same(latest.errors, []);
      sub.same(latest.thrown, []);
      sub.same(latest.notes, null);
      sub.same(history, [1, 2, 3]);

      count.next(4.5);

      sub.same(latest.next, 4);
      sub.same(latest.nextValue, 4);
      sub.same(latest.errors, []);
      sub.same(latest.thrown, []);
      sub.same(latest.notes, null);
      sub.same(history, [1, 2, 3, 4]);

      count.next('five');
      sub.same(latest.next, 'five');
      sub.same(latest.nextValue, ABSENT);
      sub.same(latest.errors, []);
      sub.same(latest.notes, null);
      sub.same(latest.thrown[0].error.message, 'not a number');
      sub.same(latest.thrown[0].at, 'pre');
      sub.same(count.value, 4);
      sub.same(history, [1, 2, 3, 4]);

      count.complete();

      count.next(6);

      // completed streams don't emit.

      sub.same(latest.next, 'five');
      sub.same(latest.nextValue, ABSENT);
      sub.same(latest.errors, []);
      sub.same(latest.notes, null);
      sub.same(history, [1, 2, 3, 4]);

      sub.end();
    });

    preFilter.end();
  });

  suite.end();
});
