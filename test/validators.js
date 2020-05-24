/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../package.json');

const { validators } = require('../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('validators', (vals) => {
    vals.test('string', (valStr) => {
      valStr.notOk(validators('string')('alpha'));
      valStr.ok(validators('string')(1));
      valStr.end();
    });
    vals.end();
  });

  suite.end();
});
