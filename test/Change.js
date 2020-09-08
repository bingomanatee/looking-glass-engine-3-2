/* eslint-disable camelcase */
const tap = require('tap');
const { filter } = require('rxjs/operators');
const p = require('../package.json');
const { Change, STAGE_BEGIN } = require('../lib');

// const positive = new Meta((a) => (a >= 0 ? false : 'must be > 0'), 'positive', 1);

/**
 *  testing basic name, value, deserialization
 *
 */

const changeSubject = (...params) => new Change({}, ...params);

tap.test(p.name, (suite) => {
  suite.test('changeSubject', (cs) => {
    cs.test('minimal', (csm) => {
      const change = changeSubject('simple', 1);
      const COMPLETE = Symbol('complete');
      const values = [];
      csm.same(change.action, 'simple');
      csm.same(change.value, 1);
      csm.same(change.stage, STAGE_BEGIN);
      change.subscribe((v) => values.push(v), (e) => values.push(e.message), () => values.push(COMPLETE));
      csm.same(values, [{ value: 1, stage: STAGE_BEGIN, action: 'simple' }]);

      change.complete();
      csm.same(values, [{ value: 1, stage: STAGE_BEGIN, action: 'simple' }, COMPLETE]);

      csm.end();
    });

    cs.test('minimal error', (csm) => {
      const change = changeSubject('simple', 1);
      const COMPLETE = Symbol('complete');
      const values = [];
      csm.same(change.action, 'simple');
      csm.same(change.value, 1);
      csm.same(change.stage, STAGE_BEGIN);
      change.subscribe((v) => values.push(v), (e) => values.push(e.message), () => values.push(COMPLETE));
      csm.same(values, [{ value: 1, stage: STAGE_BEGIN, action: 'simple' }]);
      change.error(new Error('failure is always an option'));
      csm.same(values, [{ value: 1, stage: STAGE_BEGIN, action: 'simple' }, 'failure is always an option']);
      csm.end();
    });

    cs.test('next', (csm) => {
      const change = changeSubject('simple', 1);
      const COMPLETE = Symbol('complete');
      const values = [];
      change.subscribe((v) => values.push(v), (e) => values.push(e.message), () => values.push(COMPLETE));
      change.next(2);
      const STAGE_FOO = Symbol('foo');
      const STAGE_BAR = Symbol('bar');
      csm.same(values, [
        { value: 1, stage: STAGE_BEGIN, action: 'simple' },
        { value: 2, stage: STAGE_BEGIN, action: 'simple' }]);

      change.nextStage(STAGE_FOO);
      csm.same(values, [
        { value: 1, stage: STAGE_BEGIN, action: 'simple' },
        { value: 2, stage: STAGE_BEGIN, action: 'simple' },
        { value: 2, stage: STAGE_FOO, action: 'simple' },
      ]);

      change.next(4);
      change.nextStage(STAGE_BAR);

      csm.same(values, [
        { value: 1, stage: STAGE_BEGIN, action: 'simple' },
        { value: 2, stage: STAGE_BEGIN, action: 'simple' },
        { value: 2, stage: STAGE_FOO, action: 'simple' },
        { value: 4, stage: STAGE_FOO, action: 'simple' },
        { value: 4, stage: STAGE_BAR, action: 'simple' },
      ]);

      change.complete();

      csm.same(values, [
        { value: 1, stage: STAGE_BEGIN, action: 'simple' },
        { value: 2, stage: STAGE_BEGIN, action: 'simple' },
        { value: 2, stage: STAGE_FOO, action: 'simple' },
        { value: 4, stage: STAGE_FOO, action: 'simple' },
        { value: 4, stage: STAGE_BAR, action: 'simple' },
        COMPLETE,
      ]);

      csm.end();
    });

    cs.test('filtered', (csm) => {
      const change = changeSubject('simple', 1);
      const COMPLETE = Symbol('complete');
      const values = [];
      const STAGE_FOO = Symbol('foo');
      const STAGE_BAR = Symbol('bar');
      change.pipe(
        filter(({ stage }) => stage === STAGE_FOO),
      ).subscribe((v) => values.push(v), (e) => values.push(e.message), () => values.push(COMPLETE));

      csm.same(values, []);

      change.next(2);
      csm.same(values, []);

      change.nextStage(STAGE_FOO);
      csm.same(values, [
        { value: 2, stage: STAGE_FOO, action: 'simple' },
      ]);

      change.nextStage(STAGE_BAR);
      change.next(4);
      csm.same(values, [
        { value: 2, stage: STAGE_FOO, action: 'simple' },
      ]);

      change.complete();
      csm.same(values, [
        { value: 2, stage: STAGE_FOO, action: 'simple' },
        COMPLETE,
      ]);

      csm.end();
    });

    cs.end();
  });
  suite.end();
});
