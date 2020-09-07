/* eslint-disable camelcase */

import { isNumber } from '../src/validators';
import { ACTION_NEXT, STAGE_COMPLETE, STAGE_PROCESS } from '../src/constants';

const tap = require('tap');
const p = require('../package.json');
const pick = require('../src/pick');
const { ValueStore } = require('../lib');

// const positive = new Meta((a) => (a >= 0 ? false : 'must be > 0'), 'positive', 1);

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStore', (vs) => {
    vs.test('properties, setters', (props) => {
      const store = new ValueStore({ x: 0, y: 0 });

      let latest = new Map();
      const history = [];
      const FIRST = new Map([['x', 0], ['y', 0]]);
      const SECOND = new Map([['x', 3], ['y', 0]]);
      const THIRD = new Map([['x', 3], ['y', 4]]);

      store.subscribe((value) => {
        latest = value;
        history.push(value);
      });

      props.same(history, [FIRST]);
      props.same(latest.get('x'), 0);
      props.same(latest.get('y'), 0);

      store.do.setX(3);

      props.same(history, [FIRST, SECOND]);
      props.same(latest.get('x'), 3);
      props.same(latest.get('y'), 0);

      store.do.setY(4);

      props.same(history, [FIRST, SECOND, THIRD]);
      props.same(latest.get('x'), 3);
      props.same(latest.get('y'), 4);

      store.complete();

      store.do.setX(5);

      props.same(history, [FIRST, SECOND, THIRD]);
      props.same(latest.get('x'), 3);
      props.same(latest.get('y'), 4);

      props.end();
    });

    vs.test('custom stages', (cs) => {
      const STAGE_ERRORS = Symbol('errors');
      const store = new ValueStore(0, {
        nextStages: [STAGE_PROCESS, STAGE_ERRORS],
        actions: {
          offset: (stream, value) => {
            stream.next(stream.value + value);
          },
        },
      });

      const events = [];

      store.on(() => true, (change) => {
        events.push({ action: change.action, value: change.value, stage: change.stage });
      });

      store.next(2);

      cs.same(events, [
        { action: 'next', value: 2, stage: 'initial' },
        { action: 'next', value: 2, stage: 'process' },
        { action: 'next', value: 2, stage: STAGE_ERRORS },
        { action: 'next', value: 2, stage: 'complete' },
      ]);

      cs.end();
    });

    vs.test('nested Stores', (ns) => {
      console.log('------------ nexted streams ----------');

      function formField(name, value, test) {
        const store = new ValueStore({ value, errorMessage: '', touched: false });

        store.streams.get('value').on({ action: ACTION_NEXT, stage: STAGE_COMPLETE },
          (change) => {
            if (!store.value.get('touched')) {
              store.set('touched', true);
            }
            store.do.setErrorMessage(test(change.value) || '');
          });

        return store;
      }

      const form = new ValueStore({ name: '', password: '' });
      form.DEBUG = true;

      form.addStream('name', formField('name', '', (value) => {
        if (!value) {
          return ('name must be set');
        }
        return false;
      }));

      form.addStream('password', formField('password', '', (value) => {
        if (!value) {
          return ('password must be set');
        }
        if (value.length < 4) return 'password must be >= 4 characters';
        return false;
      }));

      form.action('updateFormValue', (store, name, value) => {
        store.streams.get(name).do.setValue(value);
      });

      const STEP_ONE = new Map(
        [
          ['name', new Map([
            ['value', ''],
            ['errorMessage', ''],
            ['touched', false],
          ])],

          ['password', new Map([
            ['value', ''],
            ['errorMessage', ''],
            ['touched', false],
          ])],
        ],
      );
      const STEP_TWO = new Map(
        [
          ['name', new Map([
            ['value', ''],
            ['errorMessage', ''],
            ['touched', false],
          ])],

          ['password', new Map([
            ['value', 'ABC'],
            ['errorMessage', 'password must be >= 4 characters'],
            ['touched', true],
          ])],
        ],
      );
      const STEP_THREE = new Map(
        [
          ['name', new Map([
            ['value', ''],
            ['errorMessage', ''],
            ['touched', false],
          ])],

          ['password', new Map([
            ['value', 'ABCdef'],
            ['errorMessage', ''],
            ['touched', true],
          ])],
        ],
      );
      const history = [];

      form.subscribe((next) => history.push(next));

      ns.same(history,
        [
          STEP_ONE,
        ]);

      form.do.updateFormValue('password', 'ABC');

      ns.same(history,
        [
          STEP_ONE,
          STEP_TWO,
        ]);
      form.do.updateFormValue('password', 'ABCdef');

      ns.same(history,
        [
          STEP_ONE,
          STEP_TWO,
          STEP_THREE
        ]);

      ns.end();
    });

    vs.end();
  });

  suite.end();
});
