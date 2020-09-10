/* eslint-disable camelcase */

import { isNumber } from '../src/validators';
import { ACTION_NEXT, STAGE_COMPLETE, STAGE_PROCESS } from '../src/constants';

const tap = require('tap');
const p = require('../package.json');
const pick = require('../src/pick');
const { ValueStoreObject } = require('../lib');

// const positive = new Meta((a) => (a >= 0 ? false : 'must be > 0'), 'positive', 1);

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStoreObject', (vs) => {
    vs.test('properties, setters', (props) => {
      const store = new ValueStoreObject({ x: 0, y: 0 });

      let latest = new Map();
      const history = [];
      const FIRST = { x: 0, y: 0 };
      const SECOND = { x: 3, y: 0 };
      const THIRD = { x: 3, y: 4 };

      store.subscribe((value) => {
        latest = value;
        history.push(value);
      });

      props.same(history, [FIRST]);
      props.same(latest.x, 0);
      props.same(latest.y, 0);

      store.do.setX(3);

      props.same(history, [FIRST, SECOND]);
      props.same(latest.x, 3);
      props.same(latest.y, 0);

      store.do.setY(4);

      props.same(history, [FIRST, SECOND, THIRD]);
      props.same(latest.x, 3);
      props.same(latest.y, 4);

      store.complete();

      store.do.setX(5);

      props.same(history, [FIRST, SECOND, THIRD]);
      props.same(latest.x, 3);
      props.same(latest.y, 4);

      props.end();
    });

    vs.test('custom stages', (cs) => {
      const STAGE_ERRORS = Symbol('errors');
      const store = new ValueStoreObject(0, {
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
        { action: 'next', value: 2, stage: 'pending' },
        { action: 'next', value: 2, stage: 'complete' },
      ]);

      cs.end();
    });

    vs.test('nested Stores', (ns) => {
      function formField(name, value, test) {
        const store = new ValueStoreObject({ value, errorMessage: '', touched: false }, {
          actions: {
            reset(store) {
              store.do.setTouched(false);
              store.do.setErrorMessage('');
            },
          },
        });
        store.streams.get('value').subscribe(
          (next) => {
            if (!store.value.touched) {
              store.set('touched', true);
            }
            store.do.setErrorMessage(test(next) || '');
          },
        );
        store.do.reset();

        return store;
      }

      const form = new ValueStoreObject({ name: '', password: '' });
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

      const STEP_ONE = {
        name: { value: '', errorMessage: '', touched: false },
        password: { value: '', errorMessage: '', touched: false },
      };
      const STEP_TWO = {
        name: { value: '', errorMessage: '', touched: false },
        password: { value: 'ABC', errorMessage: 'password must be >= 4 characters', touched: true },
      };

      const STEP_THREE = {
        name: { value: '', errorMessage: '', touched: false },
        password: { value: 'ABCdef', errorMessage: '', touched: true },
      };

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
          STEP_THREE,
        ]);

      ns.end();
    });

    vs.test('watch', (w) => {
      const store = new ValueStoreObject({ x: 0, y: 0, z: 0 });
      const history = [];
      const watchHistory = [];

      store.watch('x', 'y').subscribe((values) => {
        watchHistory.push(Math.floor(Math.sqrt(values.x ** 2 + values.y ** 2)));
      });

      store.subscribe((value) => history.push(value));
      const STAGE_ONE = { x: 0, y: 0, z: 0 };

      const STAGE_TWO = { x: 10, y: 0, z: 0 };
      const STAGE_THREE = { x: 10, y: 20, z: 0 };
      const STAGE_FOUR = { x: 10, y: 20, z: 30 };

      w.same(history, [STAGE_ONE]);
      w.same(watchHistory, [0]);

      store.do.setX(10);

      w.same(history, [STAGE_ONE, STAGE_TWO]);
      w.same(watchHistory, [0, 10]);

      w.same(history, [STAGE_ONE, STAGE_TWO]);
      w.same(watchHistory, [0, 10]);

      store.do.setY(20);
      w.same(history, [STAGE_ONE, STAGE_TWO, STAGE_THREE]);
      w.same(watchHistory, [0, 10, 22]);

      store.do.setZ(30);
      w.same(history, [STAGE_ONE, STAGE_TWO, STAGE_THREE, STAGE_FOUR]);
      w.same(watchHistory, [0, 10, 22]);

      w.end();
    });

    vs.test('filter', (w) => {
      const store = new ValueStoreObject({ x: 0, y: 0, z: 0 });
      const history = [];
      const watchHistory = [];

      store.watch('x', 'y').subscribe((values) => {
        watchHistory.push(Math.floor(Math.sqrt(values.x ** 2 + values.y ** 2)));
      });

      store.subscribe((value) => history.push(value));
      const STEP_ONE = { x: 0, y: 0, z: 0 };
      const STAGE_TWO = { x: 10, y: 0, z: 0 };
      const STEP_THREE = { x: 10, y: 20, z: 0 };
      const STEP_FOUR = { x: 10, y: 20, z: 30 };

      w.same(history, [STEP_ONE]);
      w.same(watchHistory, [0]);

      store.do.setX(10);

      w.same(history, [STEP_ONE, STAGE_TWO]);
      w.same(watchHistory, [0, 10]);

      w.same(history, [STEP_ONE, STAGE_TWO]);
      w.same(watchHistory, [0, 10]);

      store.do.setY(20);
      w.same(history, [STEP_ONE, STAGE_TWO, STEP_THREE]);
      w.same(watchHistory, [0, 10, 22]);

      store.do.setZ(30);
      w.same(history, [STEP_ONE, STAGE_TWO, STEP_THREE, STEP_FOUR]);
      w.same(watchHistory, [0, 10, 22]);

      w.end();
    });

    vs.end();
  });

  suite.end();
});
