const registry = new Map();

const validators = (name, value, override = false) => {
  if (value && typeof value === 'function') {
    if (registry.has(name) && !override) {
      if (!(registry.get(name) === value)) {
        throw new Error(`cannot redefine ${name}`);
      }
    } else {
      registry.set(name, value);
    }
    return validators;
  }
  return registry.get(name);
};

validators('string', (v) => ((typeof v === 'string') ? false : 'value must be a string'));
validators('number', (v) => ((typeof v === 'number') ? false : 'value must be a number'));
validators('nan', (v) => ((typeof v !== 'number') || (Number.isNaN(v)) ? false : 'value must be not a number'));
validators('integer', (v) => ((Number.isSafeInteger(v)) ? false : 'value must be an integer'));
validators('array', (v) => (Array.isArray(v) ? false : 'value must be an array'));
validators('object', (v) => (v && (typeof v === 'object') ? false : 'value must be an object'));
export default validators;
