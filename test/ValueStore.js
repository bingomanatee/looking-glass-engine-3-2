/* eslint-disable camelcase */

import { isNumber } from '../src/validators';

const tap = require('tap');
const p = require('../package.json');

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
      store.DEBUG = true;

      const latest = {};
      const history = [];
      const FIRST = { x: 0, y: 0 };
      const SECOND = { x: 3, y: 0 };
      const THIRD = { x: 3, y: 4 };

      store.subscribe((value) => {
        Object.assign(latest, value);
        history.push(value);
      });

      props.same(history, [FIRST]);
      props.same(latest.x, 0);
      props.same(store.streams.get('x').value, 0);
      props.same(latest.y, 0);
      props.same(store.streams.get('y').value, 0);

      store.do.setX(3);

      props.same(history, [FIRST, SECOND]);
      props.same(latest.x, 3);
      props.same(store.streams.get('x').value, 3);
      props.same(latest.y, 0);
      props.same(store.streams.get('y').value, 0);

      store.do.setY(4);

      props.same(history, [FIRST, SECOND, THIRD]);
      props.same(latest.x, 3);
      props.same(store.streams.get('x').value, 3);
      props.same(latest.y, 4);
      props.same(store.streams.get('y').value, 4);

      store.complete();

      store.do.setX(5);

      props.same(history, [FIRST, SECOND, THIRD]);
      props.same(latest.x, 3);
      props.same(store.streams.get('x').value, 3);
      props.same(latest.y, 4);
      props.same(store.streams.get('y').value, 4);

      props.end();
    });

    vs.end();
  });

  suite.end();
});
