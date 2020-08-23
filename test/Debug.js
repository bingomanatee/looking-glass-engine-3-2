/* eslint-disable camelcase */

import { isNumber } from '../src/validators';

const tap = require('tap');
const p = require('../package.json');

const { ValueStore } = require('../lib');


/**
 *  testing basic name, value, deserialization
 *
 */

if (false) tap.test(p.name, (suite) => {
  suite.test('ValueStore', (vs) => {
    const store = new ValueStore({ x: 0 });
    let latest = {};
    const history = [];
    store.subscribe((value) => {
      history.push(value);
      latest = value;
    });

    const INITIAL = {
      x: {
        value: 0,
        lastValid: 0,
        meta: [],
      },
    };

    const NEXT = {
      x: {
        value: 2,
        lastValid: 2,
        meta: [],
      },
    };

    vs.same(latest, INITIAL);

    vs.same(history, [INITIAL]);

    store.do.setX(2);

    vs.same(latest, NEXT);

    vs.same(history, [INITIAL, NEXT]);

    vs.end();
  });
  suite.end();
});
