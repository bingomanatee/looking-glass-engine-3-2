/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../../package.json');

const { ValueStream } = require('../../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStream', (vs) => {
    vs.test('name', (tName) => {
      tName.test('(valid)', (tNameV) => {
        tNameV.test('single value - no value', (tNameSV) => {
          const s = new ValueStream('alpha');
          tNameSV.equal(s.name, 'alpha');
          tNameSV.end();
        });

        tNameV.test('single value - value', (tNameSV) => {
          const s = new ValueStream('alpha', 3);
          tNameSV.equal(s.name, 'alpha');
          tNameSV.end();
        });

        tNameV.test('numeric name', (tNameSV) => {
          const s = new ValueStream(5, 3);
          tNameSV.equal(s.name, 5);
          tNameSV.end();
        });

        tNameV.end();
      });

      tName.test('(invalid)', (tNameI) => {
        tNameI.test('none passed', (tNameIP) => {
          tNameIP.throws(() => {
            const empty = new ValueStream();
          }, 'cannot initialize ValueStream with bad name');
          tNameIP.end();
        });

        tNameI.test('empty string passed', (tNameEmptyString) => {
          tNameEmptyString.throws(() => {
            const empty = new ValueStream('');
            console.log('empty value stream:', empty);
          }, 'cannot initialize ValueStream with bad name');
          tNameEmptyString.end();
        });

        tNameI.test('non- string passed', (tNameIP) => {
          tNameIP.throws(() => {
            const empty = new ValueStream([4]);
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
          const s = new ValueStream('alpha');
          tValueA.equal(s.value, undefined);
          tValueA.notOk(s.hasChildren);
          tValueA.end();
        });

        tSValue.test('numeric', (tValueN) => {
          const s = new ValueStream('alpha', 4);
          tValueN.equal(s.value, 4);
          tValueN.notOk(s.hasChildren);
          tValueN.end();
        });

        tSValue.end();
      });

      tValue.test('(children)', (tCValue) => {
        tCValue.test('single', (tCValueSingle) => {
          const alpha = new ValueStream('alpha');
          alpha._add('beta', 1);
          tCValueSingle.same(alpha.value, { beta: 1 });

          tCValueSingle.end();
        });

        tCValue.test('multi', (tCValueMulti) => {
          const alpha = new ValueStream('alpha');
          alpha._add('beta', 1);
          alpha._add('gamma', 'two');
          tCValueMulti.same(alpha.value, { beta: 1, gamma: 'two' });

          tCValueMulti.end();
        });

        tCValue.end();
      });

      tValue.end();
    });

    vs.end();
  });

  suite.end();
});
