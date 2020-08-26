/* eslint-disable camelcase */
const { Subject } = require('rxjs');
const tap = require('tap');
const p = require('../package.json');

const { Stream, ABSENT, Change } = require('../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('basic', (noPrePost) => {
    noPrePost.test('subscribe', (sub) => {
      const updates = [];
      const fakeStore = new Subject();
      fakeStore.subscribe((change) => updates.push(change.toJSON(updates.length + 1)));
      const count = new Stream(fakeStore, 'count', 1);

      let latest = null;
      const history = [];
      count.subscribe((output) => {
        latest = output;
        history.push(output);
      }, (err) => {
        console.log('error in subscribe: ', err);
      });

      const FIRST = {
        value: 1,
        lastValue: 1,
        nextValue: 1,
        id: 1,
      };
      const SECOND = {
        value: 2,
        lastValue: 1,
        nextValue: 2,
        id: 2,
      };
      const THIRD = {
        value: 100,
        lastValue: 2,
        nextValue: 100,
        id: 3,
      };

      sub.same(latest, 1);
      sub.same(count.value, 1);
      sub.same(updates, [FIRST]);
      sub.same(history, [1]);

      count.next(2);

      sub.same(latest, 2);
      sub.same(count.value, 2);
      sub.same(updates, [FIRST, SECOND]);
      sub.same(history, [1, 2]);

      count.next(100);

      sub.same(latest, 100);
      sub.same(count.value, 100);
      sub.same(updates, [FIRST, SECOND, THIRD]);
      sub.same(history, [1, 2, 100]);

      count.complete();

      count.next(200);

      sub.same(latest, 100);
      sub.same(count.value, 100);
      sub.same(updates, [FIRST, SECOND, THIRD]);
      sub.same(history, [1, 2, 100]);

      sub.end();
    });
    noPrePost.end();
  });

  suite.test('with pre', (postFilter) => {
    postFilter.test('subscribe - filter', (sub) => {
      const updates = [];
      const fakeStore = new Subject();
      fakeStore.subscribe((change) => updates.push(change.toJSON(updates.length + 1)));
      const count = new Stream(fakeStore, 'count', 1, (value) => {
        if (typeof value !== 'number') {
          return 0;
        }
        return Math.floor(value);
      });

      let latest = null;
      const history = [];
      count.subscribe((output) => {
        latest = output;
        history.push(output);
      }, (err) => {
        console.log('error in subscribe: ', err);
      });

      const FIRST = {
        value: 1,
        lastValue: 1,
        nextValue: 1,
        id: 1,
      };
      const SECOND = {
        value: 2.5,
        lastValue: 1,
        nextValue: 2,
        id: 2,
      };
      const THIRD = {
        value: 'one hundred',
        lastValue: 2,
        nextValue: 0,
        id: 3,
      };

      sub.same(latest, 1);
      sub.same(count.value, 1);
      sub.same(updates, [FIRST]);
      sub.same(history, [1]);

      count.next(2.5);

      sub.same(latest, 2);
      sub.same(count.value, 2);
      sub.same(updates, [FIRST, SECOND]);
      sub.same(history, [1, 2]);

      count.next('one hundred');

      sub.same(latest, 0);
      sub.same(count.value, 0);
      sub.same(updates, [FIRST, SECOND, THIRD]);
      sub.same(history, [1, 2, 0]);

      count.complete();

      count.next(200);

      sub.same(latest, 0);
      sub.same(count.value, 0);
      sub.same(updates, [FIRST, SECOND, THIRD]);
      sub.same(history, [1, 2, 0]);

      sub.end();
    });
    postFilter.test('subscribe - filter and throw', (subThrow) => {
      const updates = [];
      const fakeStore = new Subject();
      fakeStore.subscribe((change) => {
        updates.push(change.toJSON(updates.length + 1));
      });
      const count = new Stream(fakeStore, 'count', 1, (value) => {
        if (typeof value !== 'number') {
          throw new Error('not a number');
        }
        return Math.floor(value);
      });

      let latest = null;
      const history = [];
      count.subscribe((output) => {
        latest = output;
        history.push(output);
      }, (err) => {
        console.log('error in subscribe: ', err);
      });

      const FIRST = {
        value: 1,
        lastValue: 1,
        nextValue: 1,
        id: 1,
      };
      const SECOND = {
        value: 2.5,
        lastValue: 1,
        nextValue: 2,
        id: 2,
      };
      const THIRD = {
        id: 3,
        value: 'one hundred',
        nextValue: 'one hundred',
        lastValue: 2,
        thrown: 'not a number',
        thrownAt: 'pre',
      };

      const FOURTH = {
        value: 100.1,
        lastValue: 2,
        nextValue: 100,
        id: 4,
      };

      subThrow.same(latest, 1);
      subThrow.same(count.value, 1);
      subThrow.same(updates, [FIRST]);
      subThrow.same(history, [1]);

      count.next(2.5);

      subThrow.same(latest, 2);
      subThrow.same(count.value, 2);
      subThrow.same(updates, [FIRST, SECOND]);
      subThrow.same(history, [1, 2]);
      let err;

      try {
        count.next('one hundred');
      } catch (error) {
        err = error;
      }
      subThrow.same(err.message, 'not a number');

      subThrow.same(latest, 2);
      subThrow.same(count.value, 2);
      subThrow.same(updates, [FIRST, SECOND, THIRD]);
      subThrow.same(history, [1, 2]);

      count.next(100.1);

      subThrow.same(latest, 100);
      subThrow.same(count.value, 100);
      subThrow.same(updates, [FIRST, SECOND, THIRD, FOURTH]);
      subThrow.same(history, [1, 2, 100]);

      count.complete();

      count.next(200);

      subThrow.same(latest, 100);
      subThrow.same(count.value, 100);
      subThrow.same(updates, [FIRST, SECOND, THIRD, FOURTH]);
      subThrow.same(history, [1, 2, 100]);

      subThrow.end();
    });
    postFilter.test('subscribe - filter and error', (subThrow) => {
      const updates = [];
      const fakeStore = new Subject();
      fakeStore.subscribe((change) => {
        updates.push(change.toJSON(updates.length + 1));
      });
      const count = new Stream(fakeStore, 'count', 1, (value, { errors }) => {
        if (typeof value !== 'number') {
          errors.push('not a number');
          return 0;
        }
        return Math.floor(value);
      });

      let latest = null;
      const history = [];
      count.subscribe((output) => {
        latest = output;
        history.push(output);
      }, (err) => {
        console.log('error in subscribe: ', err);
      });

      const FIRST = {
        value: 1,
        lastValue: 1,
        nextValue: 1,
        id: 1,
      };
      const SECOND = {
        value: 2.5,
        lastValue: 1,
        nextValue: 2,
        id: 2,
      };
      const THIRD = {
        id: 3,
        value: 'one hundred',
        lastValue: 2,
        nextValue: 0,
        errors: ['not a number'],
      };

      const FOURTH = {
        value: 100.1,
        lastValue: 0,
        nextValue: 100,
        id: 4,
      };

      subThrow.same(latest, 1);
      subThrow.same(count.value, 1);
      subThrow.same(updates, [FIRST]);
      subThrow.same(history, [1]);

      count.next(2.5);

      subThrow.same(latest, 2);
      subThrow.same(count.value, 2);
      subThrow.same(updates, [FIRST, SECOND]);
      subThrow.same(history, [1, 2]);

      count.next('one hundred');

      subThrow.same(latest, 0);
      subThrow.same(count.value, 0);
      subThrow.same(updates, [FIRST, SECOND, THIRD]);
      subThrow.same(history, [1, 2, 0]);

      count.next(100.1);

      subThrow.same(latest, 100);
      subThrow.same(count.value, 100);
      subThrow.same(updates, [FIRST, SECOND, THIRD, FOURTH]);
      subThrow.same(history, [1, 2, 0, 100]);

      count.complete();

      count.next(200);

      subThrow.same(latest, 100);
      subThrow.same(count.value, 100);
      subThrow.same(updates, [FIRST, SECOND, THIRD, FOURTH]);
      subThrow.same(history, [1, 2, 0, 100]);

      subThrow.end();
    });
    postFilter.test('subscribe - filter and note', (subThrow) => {
      const updates = [];
      const fakeStore = new Subject();
      fakeStore.subscribe((change) => {
        updates.push(change.toJSON(updates.length + 1));
      });
      const count = new Stream(fakeStore, 'count', 1, (value, change) => {
        if (typeof value !== 'number') {
          change.notes = { floor: 0 };
          change.errors.push('not a number');
          return 0;
        }
        change.notes = { floor: Math.floor(value) };
        return value;
      });

      let latest = null;
      const history = [];
      count.subscribe((output) => {
        latest = output;
        history.push(output);
      }, (err) => {
        console.log('error in subscribe: ', err);
      });

      const FIRST = {
        value: 1,
        lastValue: 1,
        nextValue: 1,
        id: 1,
        notes: { floor: 1 },
      };
      const SECOND = {
        value: 2.5,
        lastValue: 1,
        nextValue: 2.5,
        notes: { floor: 2 },
        id: 2,
      };
      const THIRD = {
        id: 3,
        value: 'one hundred',
        lastValue: 2.5,
        nextValue: 0,
        notes: { floor: 0 },
        errors: ['not a number'],
      };

      const FOURTH = {
        value: 100.1,
        lastValue: 0,
        nextValue: 100.1,
        notes: { floor: 100 },
        id: 4,
      };

      subThrow.same(latest, 1);
      subThrow.same(count.value, 1);
      subThrow.same(updates, [FIRST]);
      subThrow.same(history, [1]);

      count.next(2.5);

      subThrow.same(latest, 2.5);
      subThrow.same(count.value, 2.5);
      subThrow.same(updates, [FIRST, SECOND]);
      subThrow.same(history, [1, 2.5]);

      count.next('one hundred');

      subThrow.same(latest, 0);
      subThrow.same(count.value, 0);
      subThrow.same(updates, [FIRST, SECOND, THIRD]);
      subThrow.same(history, [1, 2.5, 0]);

      count.next(100.1);

      subThrow.same(latest, 100.1);
      subThrow.same(count.value, 100.1);
      subThrow.same(updates, [FIRST, SECOND, THIRD, FOURTH]);
      subThrow.same(history, [1, 2.5, 0, 100.1]);

      count.complete();

      count.next(200);

      subThrow.same(latest, 100.1);
      subThrow.same(count.value, 100.1);
      subThrow.same(updates, [FIRST, SECOND, THIRD, FOURTH]);
      subThrow.same(history, [1, 2.5, 0, 100.1]);

      subThrow.end();
    });
    postFilter.end();
  });

  suite.end();
});
