/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../../package.json');
const watchStream = require('../../testUtils/watchStream');

const { ValueStore } = require('../../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStore', (vs) => {
    vs.test('methods', (tMethods) => {
      const s = new ValueStore('coords',
        { x: [0, 'number'], y: [0, 'number'], z: [0, 'number'] },
        {
          scale: [(store, scale) => {
            store.do.setX(store.my.x * scale);
            store.do.setY(store.my.y * scale);
            store.do.setZ(store.my.z * scale);
          }, { trans: true }],
        });

      const { getUpdates, getErrors } = watchStream(s);

      s.do.setX(10);
      s.do.setY(20);
      s.do.setZ(30);
      s.do.scale(0.5);

      tMethods.same(getUpdates(), [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 20, z: 0 },
        { x: 10, y: 20, z: 30 },
        { x: 5, y: 10, z: 15 },
      ]);

      tMethods.same(getErrors(), []);

      tMethods.same(s.value, { x: 5, y: 10, z: 15 });

      tMethods.end();
    });

    vs.end();
  });

  suite.end();
});
