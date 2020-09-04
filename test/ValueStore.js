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

      let latest = new Map();
      const history = [];
      const FIRST = new Map([['x', 0], ['y', 0]])
      const SECOND = new Map([['x',3], ['y', 0]])
      const THIRD = new Map([['x', 3], ['y', 4]])

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

    vs.end();
  });

  suite.end();
});
