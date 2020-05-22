/* eslint-disable camelcase */
const tap = require('tap');
const is = require('is');
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
      tMethods.test('simple', (tMSimple) => {
        const s = new ValueStore('coords',
          { x: [0, 'number'], y: [0, 'number'], z: [0, 'number'] },
          {
            scale: [(store, scale) => {
              store.do.setX(store.my.x * scale);
              store.do.setY(store.my.y * scale);
              store.do.setZ(store.my.z * scale);
            }],
          });

        const { getUpdates, getErrors } = watchStream(s);

        s.do.setX(10);
        s.do.setY(20);
        s.do.setZ(30);
        s.do.scale(0.5);

        tMSimple.same(getUpdates(), [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 20, z: 0 },
          { x: 10, y: 20, z: 30 },
          { x: 5, y: 20, z: 30 },
          { x: 5, y: 10, z: 30 },
          { x: 5, y: 10, z: 15 },
        ]);

        tMSimple.same(getErrors(), []);

        tMSimple.same(s.value, { x: 5, y: 10, z: 15 });

        tMSimple.end();
      });

      tMethods.test('transactional', (tMTrans) => {
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

        tMTrans.same(getUpdates(), [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 20, z: 0 },
          { x: 10, y: 20, z: 30 },
          { x: 5, y: 10, z: 15 },
        ]);

        tMTrans.same(getErrors(), []);

        tMTrans.same(s.value, { x: 5, y: 10, z: 15 });

        s.complete();

        tMTrans.end();
      });

      tMethods.test('throwable', (tmThrow) => {
        const coords = new ValueStore('coords', {
          x: [1, 'number'],
          y: [1, 'number'],
        },
        {
          scale: [(store, n) => {
            if (!is.number(n)) {
              throw new Error('must be passed a number');
            }
            store.do.setX(store.my.x * n);
            store.do.setY(store.my.y * n);
          }, { throws: true }],
        });

        tmThrow.throws(() => {
          coords.do.scale('lets throw a party');
        }, new Error('must be passed a number'));

        tmThrow.end();
      });

      tMethods.test('throwable setters', (tmThrow) => {
        const coords = new ValueStore('coords', {
          x: [1, ['number', '!nan']],
          y: [1, ['number', '!nan']],
        },
        {
          scale: [(store, n) => {
            store.do.setX_ot(store.my.x * n);
            store.do.setY_ot(store.my.y * n);
          }, { throws: true }],
        });

        tmThrow.throws(() => {
          coords.do.scale('lets throw a party');
        });

        tmThrow.end();
      });

      tMethods.test('errors', (tMError) => {
        const s = new ValueStore('math',
          { number: [1, 'number'], root: [1, ['number', '!nan']] },
          {
            setNumAndRoot(s, newNumber) {
              s.do.setRoot(Math.sqrt(newNumber));
              s.do.setNumber(newNumber);
            },
          });
        const { getUpdates, getErrors } = watchStream(s);

        s.do.setNumAndRoot(36);

        tMError.same(getUpdates(), [
          {
            number: 1,
            root: 1,
          },
          {
            number: 1,
            root: 6,
          },
          {
            number: 36,
            root: 6,
          },
        ]);
        tMError.same(getErrors(), []);
        s.do.setNumAndRoot(-4);
        tMError.same(getErrors(), [
          {
            store: 'math',
            source: 'root',
            error: {
              message: 'root cannot be a nan',
              target: 'root',
              name: 'root',
              value: NaN,
              complete: false,
              prev: 6,
              trans: false,
              error: 'root cannot be a nan',
            },
          },
        ]);

        tMError.same(getUpdates(), [
          {
            number: 1,
            root: 1,
          },
          {
            number: 1,
            root: 6,
          },
          {
            number: 36,
            root: 6,
          },
          {
            number: -4,
            root: 6,
          },
        ]);

        s.complete();
        tMError.end();
      });

      tMethods.test('value sets', (vSets) => {
        const s = new ValueStore('numAndStr', {
          str: ['', 'string'],
          num: [0, ['number', '!nan']],
        });

        vSets.ok(!s.do.setStr('alpha').error);
        vSets.same(s.do.setStr(1).error, 'str must be a string');

        vSets.ok(!s.do.setNum(3).error);
        vSets.same(s.do.setNum('alpha').error, 'num must be a number, num cannot be a nan');
        vSets.same(s.do.setNum(Math.sqrt(-1)).error, 'num cannot be a nan');

        vSets.end();
      });

      tMethods.end();
    });

    vs.end();
  });

  suite.end();
});
