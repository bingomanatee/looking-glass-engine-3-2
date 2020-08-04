/* eslint-disable camelcase */

const tap = require('tap');
const p = require('../package.json');

const { ValueStore } = require('../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStore', (vs) => {
    vs.test('properties', (p) => {
      const store = new ValueStore({ x: 0, y: 0 });

      const latest = {};
      const latestV = {};

      store.subscribe((value) => Object.assign(latest, value));
      store.subscribeValue((value) => Object.assign(latestV, value));

      p.same(latest.x.value, 0);
      p.same(latest.y.value, 0);

      p.same(latestV.x, 0);
      p.same(latestV.y, 0);

      store.do.setX(2);

      p.same(latest.x.value, 2);
      p.same(latest.y.value, 0);

      p.same(latestV.x, 2);
      p.same(latestV.y, 0);

      p.end();
    });

    vs.end();
  });

  suite.end();
});
