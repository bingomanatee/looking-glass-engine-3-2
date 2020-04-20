/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../../package.json');

const { Value } = require('../../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('Value', (vs) => {
    vs.test('name', (tName) => {
      tName.test('(valid)', (tNameV) => {
        tNameV.test('no value', (tNameSV) => {
          const s = new Value('alpha');
          tNameSV.equal(s.name, 'alpha');
          tNameSV.end();
        });

        tNameV.test('value', (tNameSV) => {
          const s = new Value('alpha', 3);
          tNameSV.equal(s.name, 'alpha');
          tNameSV.end();
        });

        tNameV.test('numeric name', (tNameSV) => {
          const s = new Value(5, 3);
          tNameSV.equal(s.name, 5);
          tNameSV.end();
        });

        tNameV.end();
      });

      tName.test('(invalid)', (tNameI) => {
        tNameI.test('none passed', (tNameIP) => {
          tNameIP.throws(() => {
            const empty = new Value();
          }, 'cannot initialize ValueStream with bad name');
          tNameIP.end();
        });

        tNameI.test('empty string passed', (tNameEmptyString) => {
          tNameEmptyString.throws(() => {
            const empty = new Value('');
            console.log('empty value stream:', empty);
          }, 'cannot initialize ValueStream with bad name');
          tNameEmptyString.end();
        });

        tNameI.test('non- string passed', (tNameIP) => {
          tNameIP.throws(() => {
            const empty = new Value([4]);
          }, 'cannot initialize ValueStream with bad name');
          tNameIP.end();
        });

        tNameI.end();
      });

      tName.end();
    });

    vs.test('value', (tValue) => {
      tValue.test('(single value)', (tSValue) => {
        tSValue.test('absent', (tValueA) => {
          const s = new Value('alpha');
          tValueA.equal(s.value, undefined);
          tValueA.end();
        });

        tSValue.test('numeric', (tValueN) => {
          const s = new Value('alpha', 4);
          tValueN.equal(s.value, 4);
          tValueN.end();
        });

        tSValue.end();
      });

      tValue.end();
    });

    vs.end();
  });

  suite.end();
});
