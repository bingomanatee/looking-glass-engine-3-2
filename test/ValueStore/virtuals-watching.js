/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../../package.json');
const watchStream = require('../../testUtils/watchStream');

const { ValueStore } = require('../../lib');

/**
 *  testing basic name, value, deserialization
 *
 */

tap.test(p.name, (suite) => {
  suite.test('ValueStore', (vs) => {
    vs.test('virtuals', (tVirts) => {
      tVirts.test('basic calculus', (b) => {
        const coord = new ValueStore('coord2D', { x: 0, y: 0 }, {}, {
          magnitude: (store) => Math.sqrt(store.my.x ** 2 + store.my.y ** 2),
        });

        b.same(coord.my.magnitude, 0);
        coord.do.setX(10);
        b.same(coord.my.magnitude, 10);
        coord.do.setY(20);
        b.same(Math.round(coord.my.magnitude), 22);
        b.end();
      });
      tVirts.end();
    });
    vs.test('watching', (tWatch) => {
      const info = [];
      const coord = new ValueStore('coord3d', { x: 0, y: 0, z: 0 });
      coord.watch((xy) => {
        info.push(xy);
      }, 'x', 'y');

      tWatch.same(info, [
        { x: 0, y: 0 },
      ]);

      coord.do.setZ(100);

      tWatch.same(info, [
        { x: 0, y: 0 },
      ]);

      coord.do.setX(200);

      tWatch.same(info, [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ]);

      tWatch.end();
    });


    vs.test('watching with virtuals', (tWatch) => {
      const info = [];
      const coord = new ValueStore('coord3d', {
        x: 0, y: 0, z: 0, i: 0,
      });
      coord.addVirtual('magnitude', (s) => Math.sqrt(s.my.x ** 2 + s.my.y ** 2 + s.my.z ** 2));
      coord.watch((xy) => {
        info.push(xy);
      }, 'x', 'magnitude');

      tWatch.same(info, [
        { magnitude: 0, x: 0 },
      ]);

      coord.do.setZ(100);

      tWatch.same(info, [
        { magnitude: 0, x: 0 },
        { magnitude: 100, x: 0 },
      ]);

      coord.do.setI(100); // an unwatched, non-magnitude affecting value

      tWatch.same(info, [
        { magnitude: 0, x: 0 },
        { magnitude: 100, x: 0 },
      ]);

      tWatch.end();
    });

    vs.test('watching with virtuals and serializer', (tWatch) => {
      const info = [];
      const person = new ValueStore('person', {
        first: '', last: '',
      });
      person.addVirtual('full', (s) => `${s.my.first} ${s.my.last}`.trim());

      person.watch((xy) => {
        info.push(xy);
      }, ({ full }) => full.toLowerCase(), ['first', 'last', 'full']);

      tWatch.same(info, [
        { full: '', first: '', last: '' },
      ]);

      person.do.setFirst('bruce');
      person.do.setLast('Wayne');

      tWatch.same(info, [
        { full: '', first: '', last: '' },
        { full: 'bruce', first: 'bruce', last: '' },
        { full: 'bruce Wayne', first: 'bruce', last: 'Wayne' },
      ]);

      // this is the critical test - the serializer only looks at the lowercase full name
      // so changing the case of bruce shouldn't trigger an alert.

      person.do.setFirst('Bruce');

      tWatch.same(info, [
        { full: '', first: '', last: '' },
        { full: 'bruce', first: 'bruce', last: '' },
        { full: 'bruce Wayne', first: 'bruce', last: 'Wayne' },
      ]);

      person.do.setLast('Jenner');

      // but the change is carried through when the case -insensitve full name does change
      // as when we change the actual last name

      tWatch.same(info, [
        { full: '', first: '', last: '' },
        { full: 'bruce', first: 'bruce', last: '' },
        { full: 'bruce Wayne', first: 'bruce', last: 'Wayne' },
        { full: 'Bruce Jenner', first: 'Bruce', last: 'Jenner' },
      ]);

      tWatch.end();
    });

    vs.end();
  });

  suite.end();
});
