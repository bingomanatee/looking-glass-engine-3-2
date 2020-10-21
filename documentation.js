const documentation = require('documentation');
const streamArray = require('stream-array');
const fs = require('fs');

documentation.build(['src/ValueStream.js'], {})
  .then(documentation.formats.md)
  .then((output) => {
    fs.writeFileSync('./docs/classes/ValueStream.md', output);
  });

documentation.build(['src/ValueStore.js'], {})
  .then(documentation.formats.md)
  .then((output) => {
    fs.writeFileSync('./docs/classes/ValueStore.md', output);
  });

documentation.build(['src/ValueStoreMap.js'], {})
  .then(documentation.formats.md)
  .then((output) => {
    fs.writeFileSync('./docs/classes/ValueStoreMap.md', output);
  });

documentation.build(['src/ValueStoreObject.js'], {})
  .then(documentation.formats.md)
  .then((output) => {
    fs.writeFileSync('./docs/classes/ValueStoreObject.md', output);
  });
