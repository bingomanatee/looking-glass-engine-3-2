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

      const latest = {};
      const history = [];

      store.subscribe((value) => {
        Object.assign(latest, value);
        history.push(value);
      });

      props.same(history, [{ x: 0, y: 0 }]);
      props.same(latest.x, 0);
      props.same(latest.y, 0);

      store.do.setX(3);

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }]);
      props.same(latest.x, 3);
      props.same(latest.y, 0);

      store.do.setY(4);

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]);
      props.same(latest.x, 3);
      props.same(latest.y, 4);

      store.complete();

      store.do.setX(5);

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]);
      props.same(latest.x, 3);
      props.same(latest.y, 4);

      props.end();
    });

    vs.test('properties with pre-processors - filter style', (props) => {
      const store = new ValueStore({ x: [0, (n) => ((typeof n === 'number') ? n : 0)], y: 0 });

      const latest = {};
      const history = [];

      store.subscribe((value) => {
        Object.assign(latest, value);
        history.push(value);
      });

      props.same(history, [{ x: 0, y: 0 }]);
      props.same(latest.x, 0);
      props.same(latest.y, 0);

      store.do.setX(3);

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }]);
      props.same(latest.x, 3);
      props.same(latest.y, 0);

      store.do.setX('four');

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 0 }]);
      props.same(latest.x, 0);
      props.same(latest.y, 0);

      store.do.setY(4);

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 4 }]);
      props.same(latest.x, 0);
      props.same(latest.y, 4);

      props.end();
    });

    vs.test('properties with pre-processors - throw style', (props) => {
      const store = new ValueStore({
        x: [0, (n) => {
          if (typeof n !== 'number') throw new Error('x must be a number');
          return n;
        }],
        y: 0,
      });

      const latest = {};
      const history = [];

      store.subscribe((value) => {
        Object.assign(latest, value);
        history.push(value);
      });

      props.same(history, [{ x: 0, y: 0 }]);
      props.same(latest.x, 0);
      props.same(latest.y, 0);

      store.do.setX(3);

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }]);
      props.same(latest.x, 3);
      props.same(latest.y, 0);

      store.do.setX('four');

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }]);
      props.same(latest.x, 3);
      props.same(latest.y, 0);

      store.do.setX(5);

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 }]);
      props.same(latest.x, 5);
      props.same(latest.y, 0);

      store.do.setY(4);

      props.same(history, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }]);
      props.same(latest.x, 5);
      props.same(latest.y, 4);

      props.end();
    });

    vs.end();
  });

  suite.end();
});
