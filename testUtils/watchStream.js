const _ = require('lodash');

module.exports = (s) => {
  const errors = [];
  const es = s.errors.subscribe((msg) => {
    if(msg.toJSON) msg = msg.toJSON();
    errors.push(msg);
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
