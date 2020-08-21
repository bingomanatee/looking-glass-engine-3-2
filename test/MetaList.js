const tap = require('tap');
const p = require('../package.json');

const { } = require('../lib');

/*
const positive = new Meta((a) => (a >= 0 ? false : 'must be > 0'), 'positive', 1);
const number = new Meta('number', 'numeric', 'type');
const isEven = new Meta((a) => (a % 2 ? 'must be even' : false), 'even', 1);
const range = new Meta((a) => (a <= 100 && a >= -100 ? false : 'must be -100 ... 100'), 'range', 2);
*/
if (false) {
  tap.test(p.name, (suite) => {
    suite.test('MetaList', (ml) => {
      suite.test('constructor', (c) => {
        c.test('no test', (no) => {
          const list = new MetaList();
          no.same(list.metas, []);
          no.end();
        });

        c.test('one test-meta', (onem) => {
          const list = new MetaList(positive);
          onem.same(list.metas.length, 1);
          onem.same(list.metas[0].name, 'positive');

          onem.end();
        });

        c.test('one test-str', (ones) => {
          const list = new MetaList('number');
          ones.same(list.metas.length, 1);
          ones.same(list.metas[0].name, 'number');

          ones.end();
        });

        c.test('list', (l) => {
          const list = new MetaList([positive, number, isEven]);

          l.same(list.metas.length, 3);
          l.same(list.metas[0].name, 'positive');
          l.same(list.metas[1].name, 'numeric');
          l.same(list.metas[2].name, 'even');
          l.end();
        });

        c.end();
      });

      ml.test('_sig', (sig) => {
        sig.test('no test', (no) => {
          const list = new MetaList();
          no.same(list._sig, '');
          no.end();
        });

        sig.test('one test-meta', (onem) => {
          const list = new MetaList(positive);
          onem.same(list._sig, 'positive,1');

          onem.end();
        });

        sig.test('one test-str', (ones) => {
          const list = new MetaList('number');
          ones.same(list._sig, 'number,1');
          ones.end();
        });

        sig.test('list', (l) => {
          const list = new MetaList([positive, number, isEven, range]);

          l.same(list._sig, 'positive,1,numeric,type,even,1,range,2');
          l.end();
        });
        sig.end();
      });

      ml.test('_metaKeys', (mkey) => {
        mkey.test('no test', (no) => {
          const list = new MetaList();
          no.same(list._metaKeys, []);
          no.end();
        });

        mkey.test('one test-meta', (onem) => {
          const list = new MetaList(positive);
          onem.same(list._metaKeys, [1]);

          onem.end();
        });

        mkey.test('one test-str', (ones) => {
          const list = new MetaList('number');
          ones.same(list._metaKeys, [1]);
          ones.end();
        });

        mkey.test('list', (l) => {
          const list = new MetaList([positive, number, isEven, range]);

          l.same(list._metaKeys, ['type', 1, 2]);
          l.end();
        });

        mkey.end();
      });

      ml.test('annotate', (a) => {
        a.test('no test', (no) => {
          const list = new MetaList();

          no.same(list.getMeta(), []);
          no.same(list.getMeta(0), []);
          no.same(list.getMeta(-1), []);
          no.same(list.getMeta(1), []);
          no.same(list.getMeta(-1.5), []);
          no.same(list.getMeta(1.5), []);
          no.same(list.getMeta(-2), []);
          no.same(list.getMeta(2), []);

          no.end();
        });

        a.test('one test-meta', (one) => {
          const list = new MetaList(positive);

          one.same(list.getMeta(0), []);
          one.same(list.getMeta(), [
            {
              message: 'must be > 0',
              name: 'positive',
              level: 1,
              meta: 'positive',
              type: 'error',
            },
          ]);
          one.same(list.getMeta(-1), [
            {
              message: 'must be > 0',
              name: 'positive',
              level: 1,
              type: 'error',
              meta: 'positive',
            },
          ]);
          one.same(list.getMeta(1), []);
          one.same(list.getMeta(-1.5), [
            {
              message: 'must be > 0',
              name: 'positive',
              type: 'error',
              level: 1,
              meta: 'positive',
            }]);
          one.same(list.getMeta(1.5), []);

          one.same(list.getMeta(-2), [
            {
              message: 'must be > 0',
              name: 'positive',
              type: 'error',
              level: 1,
              meta: 'positive',
            }]);
          one.same(list.getMeta(2), []);

          one.end();
        });
        a.test('one string', (one) => {
          const list = new MetaList('number');

          one.same(list.getMeta(0), []);
          one.same(list.getMeta('zero'), [
            {
              message: 'must be number',
              type: 'error',
              name: 'number',
              level: 1,
              meta: 'number',
            },
          ]);
          one.same(list.getMeta(), [
            {
              message: 'must be number',
              type: 'error',
              name: 'number',
              level: 1,
              meta: 'number',
            },
          ]);
          one.same(list.getMeta(1), []);
          one.same(list.getMeta(null), [
            {
              message: 'must be number',
              type: 'error',
              name: 'number',
              level: 1,
              meta: 'number',
            },
          ]);

          one.end();
        });

        a.test('many', (many) => {
          const list = new MetaList(positive, number, isEven, range);

          many.same(list.getMeta(0), []);
          many.same(list.getMeta('zero'), [
            {
              message: 'must be number',
              name: 'numeric',
              level: 'type',
              meta: 'numeric',
              type: 'error',
            },
          ]);
          many.same(list.getMeta(), [
            {
              message: 'must be number',
              name: 'numeric',
              level: 'type',
              meta: 'numeric',
              type: 'error',
            },
          ]);
          many.same(list.getMeta(1), [
            {
              message: 'must be even',
              name: 'even',
              level: 1,
              meta: 'even',
              type: 'error',
            }]);
          many.same(list.getMeta(200), [
            {
              message: 'must be -100 ... 100',
              name: 'range',
              level: 2,
              meta: 'range',
              type: 'error',
            }]);
          many.same(list.getMeta(null), [
            {
              message: 'must be number',
              name: 'numeric',
              level: 'type',
              meta: 'numeric',
              type: 'error',
            },
          ]);

          many.end();
        });

        a.end();
      });

      ml.end();
    });
    suite.end();
  });
}
