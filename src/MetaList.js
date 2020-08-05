import { proppify } from '@wonderlandlabs/propper';
import flatten from './flatten';
import val, { isObject, isArray } from './validators';
import Meta from './Meta';

const EMPTY_MAP = new Map();

/**
 * This class allows you to provide related data about a field.
 * principally that includes errors but can include anything else you want to say
 * about a particular value.
 */
export default class MetaList {
  /* ---------------- initialization ------------ */

  constructor(...metas) {
    this._initMeta(metas);
    this.getMeta = this.getMeta.bind(this);
    this.orderMetas = this.orderMetas.bind(this);
  }

  add(meta) {
    this.metas.push(Meta.create(meta));
  }

  get type() {
    if (this.metas.length) {
      return this.metas[0].name || '';
    }
    return '';
  }

  _initMeta(metas) {
    this.metas = flatten(metas).filter(Meta.goodFilter).map(Meta.create);
  }

  /**
   * a string summary of the metas; relies on them having meaningful names...
   * @returns {string}
   * @private
   */
  get _sig() {
    return this.metas.reduce((out, m) => [...out, m.name, m.order], []).join(',');
  }

  _indexOf(value) {
    return this.orderKeys.includes(value) ? this.orderKeys.indexOf(value) : Number.MAX_SAFE_INTEGER;
  }

  get _metaKeys() {
    return this.metas.map(this._keyFor)
      .sort((key1, key2) => {
        const i1 = this._indexOf(key1);
        const i2 = this._indexOf(key2);
        return (i1 - i2) / (Math.abs(i1 - i2));
      })
      .reduce((out, k) => (out.includes(k) ? out : [...out, k]), []);
  }

  _keyFor(meta) {
    return meta ? meta.order : null;
  }

  orderMetas() {
    if (!this.metas.length) return EMPTY_MAP;
    if (this._cached && (this._cacheSig === this._sig)) {
      return this._cached;
    }

    const foundKeys = this._metaKeys;

    const ordered = new Map();

    foundKeys.forEach((key) => ordered.set(key, []));

    this.metas.forEach((meta) => ordered.get(this._keyFor(meta)).push(meta));
    this._cached = ordered;
    this._cacheSig = this._sig;

    return ordered;
  }

  getMeta(value, context) {
    const metaMap = this.orderMetas();
    const results = [];

    // eslint-disable-next-line no-labels,no-restricted-syntax
    eachLevel:
    for (const level of metaMap.keys()) {
      const metas = metaMap.get(level);
      if (results.length) {
        break;
      }
      for (const meta of metas) {
        const message = meta.process(value, results, context);
        if (isObject(message)) {
          results.push({ ...message, level, meta: meta.name || meta.test });

          if (message.stop) {
            // eslint-disable-next-line no-labels
            break eachLevel;
          }
        } else if (message) {
          results.push({ level, meta: meta.name || meta.test, message });
        }
      }
    }

    return results;
  }
}

MetaList.hasMetas = (filter) => {
  if (isArray(filter)) {
    return filter.filter(Meta.goodFilter).length;
  }
  return Meta.goodFilter(filter);
};

MetaList.errors = (list) => {
  if (!list.length) return false;
  return list.filter(({ type }) => type === 'error').length;
};

proppify(MetaList)
  .addProp('orderKeys', () => ['required', 'type', 0, 1, 2], 'array')
  .addProp('metas', () => ([]), 'array');
