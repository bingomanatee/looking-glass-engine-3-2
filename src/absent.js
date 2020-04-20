export const ABSENT = Symbol('ABSENT');
export const has = (v) => (v !== ABSENT) && (typeof v !== 'undefined');
export const notAbsent = (v) => v !== ABSENT;
export const isAbsent = (v) => v === ABSENT;
