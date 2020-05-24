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
    vs.test('virtuals', (tVirts) => {
      tVirts.test('basic calculus', (b) => {
        const coord = new ValueStore('coord2D', { x: 0, y: 0 }, {}, {
          magnitude: (store) => {
            return Math.sqrt(store.my.x ** 2 + store.my.y ** 2);
          },
        });

        b.same(coord.my.magnitude, 0);
        coord.do.setX(10);
        b.same(coord.my.magnitude, 10);
        coord.do.setY(20);
        b.same(Math.round(coord.my.magnitude), 22);
        b.end();
      });
      tVirts.end();
    });

    vs.end();
  });

  suite.end();
});
