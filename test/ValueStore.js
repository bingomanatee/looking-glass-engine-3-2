/* eslint-disable camelcase */

const tap = require('tap');
const p = require('../package.json');

const { ValueStore } = require('../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStore', (vs) => {
    vs.test('properties', (p) => {
      const store = new ValueStore({ x: 0, y: 0 });

      const latest = {};
      const latestV = {};

      store.subscribe((value) => Object.assign(latest, value));
      store.subscribeValue((value) => Object.assign(latestV, value));

      p.same(latest.x.value, 0);
      p.same(latest.y.value, 0);

      p.same(latestV.x, 0);
      p.same(latestV.y, 0);

      store.do.setX(2);

      p.same(latest.x.value, 2);
      p.same(latest.y.value, 0);

      p.same(latestV.x, 2);
      p.same(latestV.y, 0);

      p.end();
    });

    vs.test('properties - filtered', (p) => {
      const store = new ValueStore({ x: [0, 'number'], y: [0, 'number'] });

      const latest = {};
      const latestV = {};

      store.subscribe((value) => Object.assign(latest, value));
      store.subscribeValue((value) => Object.assign(latestV, value));

      p.same(latest.x.value, 0);
      p.same(latest.y.value, 0);

      p.same(latestV.x, 0);
      p.same(latestV.y, 0);

      store.do.setX(2);

      p.same(latest.x.value, 2);
      p.same(latest.y.value, 0);

      p.same(latestV.x, 2);
      p.same(latestV.y, 0);

      store.do.setY('three');

      p.same(latest.x.value, 2);
      p.same(latest.y.value, 'three');
      p.same(latest.y.lastValid, 0);
      p.same(latest.y.meta, [{
        message: 'must be number',
        name: 'number',
        level: 1,
        meta: 'number',
      }]);

      p.same(latestV.x, 2);
      p.same(latestV.y, 'three');

      store.do.setY(4);

      p.same(latest.x.value, 2);
      p.same(latest.y.value, 4);
      p.same(latest.y.lastValid, 4);
      p.same(latest.y.meta, []);

      p.same(latestV.x, 2);
      p.same(latestV.y, 4);

      p.end();
    });

    vs.test('my', (p) => {
      const store = new ValueStore({ x: 0, y: 0 });

      p.same(store.my.x, 0);
      p.same(store.my.y, 0);

      store.do.setX(2);

      p.same(store.my.x, 2);
      p.same(store.my.y, 0);

      p.end();
    });

    vs.test('actions', (p) => {
      const store = new ValueStore({ x: 0, y: 0 }, {
        scale: (s, m) => {
          s.do.setX(s.my.x * m);
          s.do.setY(s.my.y * m);
        },
      });

      store.do.setX(2);
      store.do.setY(3);
      store.do.scale(2);

      p.same(store.my.x, 4);
      p.same(store.my.y, 6);

      p.end();
    });

    vs.test('virtuals', (virt) => {
      const store = new ValueStore({ x: 0, y: 0 }, {
        scale: (s, m) => {
          s.do.setX(s.my.x * m);
          s.do.setY(s.my.y * m);
        },
      }, { magnitude: [({ x, y }) => Math.sqrt(x ** 2 + y ** 2), 'x', 'y'] });

      store.do.setX(2);
      store.do.setY(3);
      virt.same(Math.floor(store.my.magnitude * 100), 360); // get a few points of float but reduce decimals
      store.do.scale(2);

      virt.same(store.my.x, 4);
      virt.same(store.my.y, 6);
      virt.same(Math.floor(store.my.magnitude * 100), 721); // get a few points of float but reduce decimals

      virt.end();
    });

    vs.test('select', (s) =>{
      const selectValues = [];

      const list = new ValueStore({x: 0, y: 0, z: 0});
      list.select('x', 'y').subscribe()

      s.end();
    })

    vs.end();
  });

  suite.end();
});
