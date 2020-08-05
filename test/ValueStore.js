/* eslint-disable camelcase */

import { isNumber } from '../src/validators';

const tap = require('tap');
const p = require('../package.json');

const { ValueStore, Meta } = require('../lib');

const positive = new Meta((a) => (a >= 0 ? false : 'must be > 0'), 'positive', 1);

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

    vs.test('properties - meta', (p) => {
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
        type: 'error',
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

    vs.test('properties - annotation (non error meta)', (nem) => {
      const store = new ValueStore({
        x: [0, 'number'],
        y: [0, 'number'],
      });

      const latest = {};
      store.subscribe((value) => {
        Object.assign(latest, value);
      });

      const absf = (a) => ({
        message: isNumber(a) ? Math.abs(a) : 0,
        type: 'info',
        name: 'abs',
      });

      const abs = [absf, { name: 'abs' }, 2];
      store.props.x.addMeta(...abs);
      store.props.y.addMeta(...abs);

      store.do.setX(-1);

      nem.same(latest.x.meta, [{
        meta: 'abs',
        message: 1,
        type: 'info',
        name: 'abs',
        level: 2,
      }]);

      nem.same(latest.x.lastValid, -1); // -1 is allowed even with meta because there are no errors;

      store.do.setX('string');

      nem.same(latest.x.meta, [
        {
          message: 'must be number',
          name: 'number',
          type: 'error',
          level: 1,
          meta: 'number',
        }]); // update should get blocked by type error; also abs is level 2 and so, not processed

      nem.end();
    });

    vs.test('properties - preProcessed', (pp) => {
      const store = new ValueStore({
        x: [0, 'number'],
        y: [0, 'number'],
        list: [[], 'array'],
        limitList: [[], 'array'],
        limit: [10, positive],
      }).preProcess();

      const latest = {};
      const latestV = {};
      const history = [];

      store.subscribe((value) => Object.assign(latest, value));
      store.subscribeValue((value) => {
        Object.assign(latestV, value);
        history.push(value);
      });

      pp.same(latestV, {
        x: 0,
        y: 0,
        list: [],
        limitList: [],
        limit: 10,
      });

      pp.same(history, [{
        x: 0,
        y: 0,
        list: [],
        limitList: [],
        limit: 10,
      }]);

      store.do.setList('ostrich');

      pp.same(latestV, {
        x: 0,
        y: 0,
        list: [],
        limitList: [],
        limit: 10,
      });

      pp.same(history, [{
        x: 0,
        y: 0,
        list: [],
        limitList: [],
        limit: 10,
      },
      {
        x: 0,
        y: 0,
        list: [],
        limitList: [],
        limit: 10,
      }]);

      store.do.setList([4, 6, 8]);

      pp.same(latestV, {
        x: 0,
        y: 0,
        list: [4, 6, 8],
        limitList: [],
        limit: 10,
      });

      pp.same(history, [{
        x: 0,
        y: 0,
        list: [],
        limitList: [],
        limit: 10,
      },
      {
        x: 0,
        y: 0,
        list: [],
        limitList: [],
        limit: 10,
      },
      {
        x: 0,
        y: 0,
        list: [
          4,
          6,
          8,
        ],
        limitList: [],
        limit: 10,
      },
      ]);

      const { list } = store.my;
      list.push(10);
      store.do.setList(list);
      pp.notOk(store.my.list === list); // referential association broken by preprocessor
      pp.end();
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

    vs.test('select', (s) => {
      const selectValues = [];

      const list = new ValueStore({ x: 0, y: 0, z: 0 });
      list.selectValues('x', 'y').subscribe((update) => selectValues.push(update));

      s.same(selectValues, [{ x: 0, y: 0 }]);

      list.do.setX(2);
      s.same(selectValues, [{ x: 0, y: 0 }, { x: 2, y: 0 }]);

      list.do.setZ(4);
      s.same(selectValues, [{ x: 0, y: 0 }, { x: 2, y: 0 }]);

      s.end();
    });
    vs.test('select with virtuals', (s) => {
      const selectValues = [];

      const list = new ValueStore({ x: 0, y: 0, z: 0 });
      list.virtual('xyMag', ({ x, y }) => parseFloat(
        Math.sqrt(x ** 2 + y ** 2).toFixed(2),
      ), 'x', 'y');
      list.selectValues('x', 'y', 'xyMag').subscribe((update) => selectValues.push(update));

      s.same(selectValues, [{ x: 0, y: 0, xyMag: 0 }]);

      list.do.setX(2);
      s.same(selectValues, [{ x: 0, y: 0, xyMag: 0 }, { x: 2, y: 0, xyMag: 2 }]);

      list.do.setZ(4);
      s.same(selectValues, [{ x: 0, y: 0, xyMag: 0 }, { x: 2, y: 0, xyMag: 2 }]);

      list.do.setY(3);
      s.same(selectValues, [{ x: 0, y: 0, xyMag: 0 }, { x: 2, y: 0, xyMag: 2 },
        { x: 2, y: 3, xyMag: 3.61 }]);

      s.end();
    });

    vs.end();
  });

  suite.end();
});
