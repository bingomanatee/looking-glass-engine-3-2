export const ABSENT = Symbol('ABSENT');
export const hasValue = (v) => v && (v !== ABSENT);
export const has = (v) => (v !== ABSENT) && (typeof v !== 'undefined');
export const notAbsent = (v) => v !== ABSENT;
export const isAbsent = (v) => v === ABSENT;
export const ID = (a) => a;
