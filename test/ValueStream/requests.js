/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../../package.json');
const watchStream = require('../../testUtils/watchStream');
const { ValueStream } = require('../../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStream', (vs) => {
    vs.test('to', (vsRC) => {
      vsRC.test('(missing value)', (vsRCMissing) => {
        const s = new ValueStream('alpha', 4);

        const { getErrors, unsubscribe } = watchStream(s);

        s.next();
        unsubscribe();

        vsRCMissing.equals(getErrors().length, 0);
        vsRCMissing.equals(s.value, 4);

        vsRCMissing.end();
      });

      vsRC.test('basic', (vsRCMissing) => {
        const s = new ValueStream('alpha', 4);

        const { getErrors, getValue, unsubscribe } = watchStream(s);

        vsRCMissing.equals(getValue(), 4);

        s.next(5);

        vsRCMissing.equals(getErrors().length, 0);
        vsRCMissing.equals(s.value, 5);
        vsRCMissing.equals(getValue(), 5);

        unsubscribe();

        vsRCMissing.end();
      });

      vsRC.test('under transaction', (vsRCMissing) => {
        const s = new ValueStream('alpha', 4);

        const { getErrors, getValue, unsubscribe } = watchStream(s);

        const t = s.startTrans();
        s.next(5);

        vsRCMissing.equals(s.value, 5);
        vsRCMissing.equals(getValue(), 4);
        // transactional locking prevents update messaging

        t.endTrans();

        vsRCMissing.equals(getErrors().length, 0);
        vsRCMissing.equals(s.value, 5);
        vsRCMissing.equals(getValue(), 5);
        // a delayed message is sent out because transaction is done.

        unsubscribe();
        vsRCMissing.end();
      });

      vsRC.end();
    });

    vs.test('transactions', (vsT) => {
      vsT.test('baseline', (vsTbaseline) => {
        const s = new ValueStream('alpha', 4);

        const {
          getErrors, getValue, getUpdates, unsubscribe,
        } = watchStream(s);

        s.next(5);

        vsTbaseline.equals(getErrors().length, 0);
        vsTbaseline.equals(s.value, 5);
        vsTbaseline.equals(getValue(), 5);
        vsTbaseline.same(getUpdates(), [4, 5]);

        unsubscribe();
        vsTbaseline.end();
      });

      vsT.test('single transaction', (vs1trans) => {
        const s = new ValueStream('alpha', 4);

        const {
          getErrors, getValue, getUpdates, unsubscribe,
        } = watchStream(s);

        const t = s.startTrans();
        s.next(5);
        vs1trans.equals(getValue(), 4);
        vs1trans.same(getUpdates(), [4]);
        t.endTrans();

        vs1trans.equals(getValue(), 5);
        vs1trans.same(getUpdates(), [4, 5]);
        vs1trans.equals(getErrors().length, 0);

        unsubscribe();
        vs1trans.end();
      });

      vsT.test('multiple transaction', (vs1trans) => {
        const s = new ValueStream('alpha', 4);

        const {
          getErrors, getValue, getUpdates, unsubscribe,
        } = watchStream(s);

        const t = s.startTrans();
        const t2 = s.startTrans();
        s.next(5);

        vs1trans.equals(getValue(), 4);
        vs1trans.same(getUpdates(), [4]);
        t.endTrans();

        vs1trans.equals(getValue(), 4);
        vs1trans.same(getUpdates(), [4]);
        t2.endTrans();

        vs1trans.equals(getValue(), 5);
        vs1trans.same(getUpdates(), [4, 5]);
        vs1trans.equals(getErrors().length, 0);

        unsubscribe();
        vs1trans.end();
      });

      vsT.end();
    });

    vs.end();
  });

  suite.end();
});
