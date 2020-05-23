/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../../package.json');

const { Value, validators } = require('../../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('Value', (vs) => {
    vs.test('filters', (tFilter) => {
      tFilter.test('(no filter)', (tFilterNoFilter) => {
        const s = new Value('alpha', 3);
        tFilterNoFilter.notOk(s.validate());
        tFilterNoFilter.end();
      });
      tFilter.test('string filter', (tFilterString) => {
        const s = new Value('alpha', 3, 'number');
        tFilterString.same(s.validate(), []);

        const t = new Value('bad', 3, 'string');
        tFilterString.same(t.validate(), [
          'bad must be a string',
        ]);

        tFilterString.test('single error', (tSingle) => {
          tSingle.test('string, value', (tSV) => {
            const ss = new Value('alpha', 3, 'number');
            tSV.notOk(ss.validate(ss.value, true));
            tSV.end();
          });

          tSingle.test('string, bad', (tSB) => {
            const tt = new Value('bad', 3, 'string');
            tSB.same(tt.validate(tt.value, true),
              'bad must be a string');
            tSB.end();
          });

          tSingle.end();
        });

        tFilterString.end();
      });

      tFilter.test('functional filter', (tFilterFn) => {
        function isOddNumber(n) {
          if ((typeof n !== 'number') || Number.isNaN(n)) {
            return 'not a number';
          }

          if ((n + 1) % 2) {
            return 'must be an odd number';
          }
          return false;
        }

        tFilterFn.test('valid', (tSF) => {
          const ss2 = new Value('oddNum', 1, isOddNumber);
          tSF.notOk(ss2.validate(ss2.value, true));

          tSF.end();
        });

        tFilterFn.test('invalid', (tSF) => {
          const ss2 = new Value('oddNum', 2, isOddNumber);
          tSF.same(ss2.validate(ss2.value, true), 'must be an odd number');

          tSF.end();
        });

        tFilterFn.end();
      });

      tFilter.test('array filter', (tFilterArray) => {
        function isOddNumber(n, errors) {
          if (errors.length) {
            return false;
          }

          if ((n + 1) % 2) {
            return 'must be an odd number';
          }
          return false;
        }

        tFilterArray.test('valid', (tSF) => {
          const ss2 = new Value('oddNum', 1, ['number', isOddNumber]);
          tSF.same(ss2.validate(ss2.value), []);

          tSF.end();
        });

        tFilterArray.test('invalid', (tSF) => {
          const ss2 = new Value('badValue', 2, ['number', isOddNumber]);
          tSF.same(ss2.validate(ss2.value), ['must be an odd number']);

          tSF.end();
        });

        tFilterArray.test('invalid', (tSF) => {
          const ss2 = new Value('badValue', '2', ['number', isOddNumber]);
          tSF.same(ss2.validate(ss2.value), ['badValue must be a number']);

          tSF.end();
        });

        tFilterArray.end();
      });

      tFilter.end();
    });

    vs.end();
  });

  suite.end();
});
