/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../../package.json');

const { ValueStore } = require('../../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStore', (vs) => {
    vs.test('properties', (tProps) => {
      const s = new ValueStore('coords', { x: 0, y: 1, z: 2 });

      tProps.same(s.name, 'coords');
      tProps.same(s.value, { x: 0, y: 1, z: 2 });

      tProps.end();
    });

    vs.end();
  });

  suite.end();
});
