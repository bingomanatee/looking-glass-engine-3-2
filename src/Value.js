import lFlattenDeep from 'lodash/flattenDeep';
import every from 'lodash/every';
import is from 'is';
import { proppify } from '@wonderlandlabs/propper';
import testVSName from './testVSName';
import {
  ABSENT, hasValue, isAbsent, notAbsent,
} from './absent';

const NOT_RE = /^!(.*)$/;
/**
 * Value is a simple name/value record.
 * The only remarkable quality is that it has the options for filtering the input next the value
 * such that only valid values are accepted; invalid values throw.
 */

class Value {
  constructor(name = ABSENT, value = ABSENT, filter = ABSENT) {
    this.name = name;
    this._value = ABSENT;
    try {
      this._setValue(value);
    } catch (err) {
      this._value = ABSENT;
    }

    if (hasValue(filter)) {
      this.filter = filter;
    }
  }

  /** *********************** IDENTITY  ****************** */

  get name() {
    return this._name;
  }

  set name(name) {
    testVSName(name, 'cannot initialize ValueStream with bad name');
    this._name = name;
  }

  hasValidName() {
    try {
      testVSName(this.name);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** *********************** VALUE, FILTER  ****************** */

  get value() {
    if (this._value === ABSENT) {
      return undefined;
    }
    return this._value;
  }

  /**
   * a private setter for value
   * @param item
   * @private
   */
  _setValue(item) {
    let errors = this.validate(item, true);
    if (!errors) {
      this._value = item;
    } else {
      if (Array.isArray(errors)) errors = errors.join(', ');
      const err = new Error(`attempt to set ${this.name} to bad value`);
      err.error = errors;
      throw err;
    }
  }

  /**
   * the error data for a prospective value
   * - or the current one if called without parameters.
   *
   * @param value
   * @param singleError {boolean} if possible return only error as a single value, not an array
   * @returns {null|boolean|*}
   */
  validate(value = ABSENT, singleError = false) {
    try {
      if (isAbsent(value)) {
        value = this.value;
      }
      if (isAbsent(value)) {
        return singleError ? null : [];
      }
      if ((!hasValue(this.filter)) || isAbsent(value)) {
        return false; // ??
      }

      const filterList = lFlattenDeep([this.filter]);
      // 99% of the time filter is a function or string.
      // however an array of same is an option,so we coerce the filter
      // into an array and reduce it below.

      const errors = this._validateList(filterList, value);

      if (!singleError) return errors;

      if (!errors.length) {
        return false;
      }
      if (errors.length === 1) {
        return errors.pop();
      }
      return errors;
    } catch (err) {
      console.log('error validating type:', err);
    }
    return false;
  }

  _validateList(tests, value) {
 /*   if (is.string(tests[0]) && /^or|\||\|\|$/.test(tests[0])) {
      return this._validateOrList(tests.slice(1), value);
    }

    if (is.string(tests[0]) && /^not|!$/.test(tests[0])) {
      return this._validateNotList(tests.slice(1), value);
    }*/

    return tests.reduce((out, filter) => {
      const err = this._validateFilter(filter, value, out);
      if (err) return [...out, err];
      return out;
    }, []);
  }
/*
  _validateOrList(filterList, value) {
    const errors = filterList.map((filter) => this._validateFilter(filter, value));
    if (every(errors)) {
      return errors;
    }
    return [];
  }

  _validateNotList(filterList, value) {
    const errors = this._validateList(filterList, value);
    if (errors.length) {
      return [];
    }
    return ['failed not condition'];
  }*/

  _validateFilter(filter, value, errors) {
    if (is.function(filter)) {
      return filter(value, errors, this);
    } if (is.string(filter)) {
      if (NOT_RE.test(filter)) {
        const m = NOT_RE.exec(filter);
        const subFilter = m[1];
        const failure = this._validateFilter(subFilter, value, errors);
        if (failure) {
          return false;
        }
        return `${this.name} cannot be a ${subFilter}`;
      }

      if (!(is[filter])) {
        return `cannot parse type ${filter}`;
      }

      if (!is[filter](value)) {
        return `${this.name} must be a ${filter}`;
      }
    }

    return false;
  }
}

proppify(Value)
  .addProp('filter', ABSENT);

export default Value;
