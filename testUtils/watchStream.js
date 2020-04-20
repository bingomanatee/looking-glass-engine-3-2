const _ = require('lodash');

module.exports = (s) => {
  const errors = [];
  const es = s.errors.subscribe((msg) => {
    errors.push({
      error: _.get(msg, 'error', msg),
      value: _.get(msg, 'value', msg),
    });
  });

  const updates = [];

  let value;

  const ss = s.subscribe((localS) => {
    value = localS.value;
    updates.push(value);
  });

  return {
    getErrors() {
      return [...errors];
    },
    getValue() {
      return value;
    },
    getUpdates() {
      return updates;
    },
    unsubscribe() {
      es.unsubscribe();
      ss.unsubscribe();
    },
  };
};
