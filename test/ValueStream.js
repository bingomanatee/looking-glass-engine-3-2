/* eslint-disable camelcase */

import { ACTION_NEXT, STAGE_BEGIN, STAGE_PROCESS } from '../src/constants';

const tap = require('tap');
const p = require('../package.json');

const { ValueStream } = require('../lib');

// const positive = new Meta((a) => (a >= 0 ? false : 'must be > 0'), 'positive', 1);

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStream', (vs) => {
    vs.test('basic', (basic) => {
      const stream = new ValueStream(1);
      const history = [];
      const errors = [];

      stream.subscribe((value) => history.push(value));
      stream.errorSubject.subscribe((change) => errors.push(change && change.thrownError.message));

      basic.same(stream.value, 1);
      basic.same(history, [1]);
      basic.same(errors, []);

      stream.next(3);
      basic.same(stream.value, 3);
      basic.same(history, [1, 3]);
      basic.same(errors, [false]);

      basic.end();
    });

    vs.test('bufferedSubject', (basic) => {
      const stream = new ValueStream(1);
      const history = [];
      const errors = [];
      const bHistory = [];

      stream._changePipe.subscribe((s) => bHistory.push(s.size));
      stream.subscribe((value) => history.push(value));
      stream.errorSubject.subscribe((change) => errors.push(change && change.thrownError.message));

      basic.same(stream.value, 1);
      basic.same(history, [1]);
      basic.same(bHistory, [0]);
      basic.same(errors, []);

      stream.next(3);
      basic.same(stream.value, 3);
      basic.same(bHistory, [0, 1, 0]);
      basic.same(history, [1, 3]);
      basic.same(errors, [false]);

      basic.end();
    });

    vs.test('error thrower', (basic) => {
      const stream = new ValueStream(1);
      stream.on({ action: ACTION_NEXT, stage: STAGE_BEGIN }, (change) => {
        if (!(typeof (change.value) === 'number')) {
          change.error(new Error('not a number'));
        }
      });
      const history = [];
      const errors = [];

      stream.subscribe((value) => history.push(value));
      stream.errorSubject.subscribe((change) => errors.push(change && change.thrownError.message));

      basic.same(stream.value, 1);
      basic.same(history, [1]);
      basic.same(errors, []);

      stream.next(3);
      basic.same(stream.value, 3);
      basic.same(history, [1, 3]);
      basic.same(errors, [false]);

      stream.next('four');
      basic.same(stream.value, 3);
      basic.same(history, [1, 3]);
      basic.same(errors, [false, 'not a number']);

      stream.next(5);
      basic.same(stream.value, 5);
      basic.same(history, [1, 3, 5]);
      basic.same(errors, [false, 'not a number', false]);

      basic.end();
    });

    vs.test('number floor', (basic) => {
      const stream = new ValueStream(1);
      stream.on({ action: ACTION_NEXT, stage: STAGE_BEGIN }, (change) => {
        if (!(typeof (change.value) === 'number')) {
          change.error(new Error('not a number'));
        }
      });

      stream.on({ action: ACTION_NEXT, stage: STAGE_PROCESS }, (change) => {
        if (change.value !== Math.round(change.value)) {
          change.next(Math.floor(change.value));
        }
      });
      const history = [];
      const errors = [];

      stream.subscribe((value) => history.push(value));
      stream.errorSubject.subscribe((change) => errors.push(change && change.thrownError.message));

      basic.same(stream.value, 1);
      basic.same(history, [1]);
      basic.same(errors, []);

      stream.next(3);
      basic.same(stream.value, 3);
      basic.same(history, [1, 3]);
      basic.same(errors, [false]);

      stream.next('four');
      basic.same(stream.value, 3);
      basic.same(history, [1, 3]);
      basic.same(errors, [false, 'not a number']);

      stream.next(5.5);
      basic.same(stream.value, 5);
      basic.same(history, [1, 3, 5]);
      basic.same(errors, [false, 'not a number', false]);

      basic.end();
    });

    vs.test('filter', (basic) => {
      const stream = new ValueStream(1);
      stream.filter((value) => {
        if (!(typeof (value) === 'number')) {
          throw (new Error('not a number'));
        }
        return Math.floor(value);
      });

      const history = [];
      const errors = [];

      stream.subscribe((value) => history.push(value));
      stream.errorSubject.subscribe((change) => errors.push(change && change.thrownError.message));

      basic.same(stream.value, 1);
      basic.same(history, [1]);
      basic.same(errors, []);

      stream.next(3);
      basic.same(stream.value, 3);
      basic.same(history, [1, 3]);
      basic.same(errors, [false]);

      stream.next('four');
      basic.same(stream.value, 3);
      basic.same(history, [1, 3]);
      basic.same(errors, [false, 'not a number']);

      stream.next(5.5);
      basic.same(stream.value, 5);
      basic.same(history, [1, 3, 5]);
      basic.same(errors, [false, 'not a number', false]);

      basic.end();
    });

    vs.end();
  });

  suite.end();
});
