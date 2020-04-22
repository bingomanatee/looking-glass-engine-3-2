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
    vs.test('properties', (tProps) => {
      tProps.test('constructor', (tPC) => {
        const s = new ValueStore('coords', { x: 0, y: 1, z: 2 });

        tPC.same(s.name, 'coords');
        tPC.same(s.value, { x: 0, y: 1, z: 2 });
        tPC.end();
      });

      tProps.test('constructor (parametric)', (tPC) => {
        const s = new ValueStore('coords', { x: [0, 'integer'], y: [1, 'integer'], z: [2, 'integer'] });

        tPC.same(s.name, 'coords');
        tPC.same(s.value, { x: 0, y: 1, z: 2 });
        tPC.end();
      });

      tProps.test('change observation', (tPO) => {
        const s = new ValueStore('coords', { x: 0, y: 1, z: 2 });
        const { getUpdates, getErrors } = watchStream(s);

        tPO.same(s.name, 'coords');
        s.streams.get('x').next(10);
        s.streams.get('y').next(20);
        tPO.same(getUpdates(), [
          { x: 0, y: 1, z: 2 },
          { x: 10, y: 1, z: 2 },
          { x: 10, y: 20, z: 2 },
        ]);
        tPO.same(getErrors(), []);

        tPO.end();
      });

      tProps.test('change observation with errors', (tPO) => {
        const s = new ValueStore('coords', { x: [0, 'integer'], y: [1, 'integer'], z: [2, 'integer'] });
        const { getUpdates, getErrors } = watchStream(s);

        tPO.same(s.name, 'coords');

        s.streams.get('x').next(10);
        s.streams.get('x').next('bob');
        s.streams.get('y').next(20);

        tPO.same(getUpdates(), [
          { x: 0, y: 1, z: 2 },
          { x: 10, y: 1, z: 2 },
          { x: 10, y: 20, z: 2 },
        ]);

        tPO.same(getErrors(), [
          {
            store: 'coords',
            source: 'x',
            error: {
              target: 'x',
              name: 'x',
              value: 'bob',
              complete: false,
              prev: 10,
              trans: false,
              error: 'x must be a integer',
            },
          },
        ]);

        tPO.end();
      });

      tProps.end();
    });

    vs.end();
  });

  suite.end();
});
