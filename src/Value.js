import lFlattenDeep from 'lodash/flattenDeep';
import is from 'is';
import { proppify } from '@wonderlandlabs/propper';
import testVSName from './testVSName';
import {
  ABSENT, hasValue, isAbsent, notAbsent,
} from './absent';

/**
 * Value is a simple name/value record.
 * The only remarkable quality is that it has the options for filtering the input next the value
 * such that only valid values are accepted; invalid values throw.
 */

class Value {
  constructor(name = ABSENT, value = ABSENT, filter = ABSENT) {
    this.name = name;
    if (notAbsent(value)) {
      this.value = value;
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
    } catch (eror) {
      return false;
    }
  }

  /** *********************** VALUE, FILTER  ****************** */

  get value() {
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
      const err = new Error(`attempt to set ${this.name}to bad value`);
      err.errors = errors;
      throw err;
    }
  }

  /**
   * the error data for a prospective value
   * - or the current one if called without parameters.
   * @param value
   * @returns null || an Exception for bad values
   */
  validate(value = ABSENT, permute = false) {
    if (isAbsent(value)) {
      if (isAbsent(this.value)) {
        return null;
      }
      return this.validate(this.value);
    }

    try {
      if ((!hasValue(this.filter)) || isAbsent(value)) {
        return false; // ??
      }

      const filterList = lFlattenDeep([this.filter]);
      // 99% of the time filter is a function or string.
      // however an array of same is an option,so we coerce the filter
      // into an array and reduce it below.

      const errors = filterList.reduce((out, filter) => {
        const err = this._validateFilter(filter, value, out);
        if (err) return [...out, err];
        return out;
      }, []);

      if (!permute) return errors;

      if (!errors.length) {
        return false;
      }
      if (errors.length === 1) {
        return errors.pop();
      }
    } catch (err) {
      console.log('error validating type:', err);
    }
    return false;
  }

  _validateFilter(filter, value, errors) {
    if (is.function(filter)) {
      return filter(value, errors, this);
    }

    if (!(is[filter])) {
      return `cannot parse type ${filter}`;
    }

    if (!is[filter](value)) {
      return `${this.name} must be a ${filter}`;
    }

    return false;
  }
}

proppify(Value)
  .addProp('filter', ABSENT);

export default Value;
