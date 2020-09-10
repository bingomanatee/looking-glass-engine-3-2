export const ACTION_POP = ('pop');// do any preparation necessary before changing the value;
export const STAGE_BEGIN = ('initial');
export const STAGE_PROCESS = ('process');
export const STAGE_PERFORM = ('perform');
// filter and clean up any issues with data sanity; make objects unique
export const STAGE_PENDING = ('pending');
// note any non-terminal error conditions
// error out if any terminal conditiona
export const STAGE_COMPLETE = ('complete');

export const ACTION_NEXT = ('next');
export const ACTION_KEY_VALUE_SET = ('map set');
export const ACTION_ARRAY_SPLICE = ('splice');
export const ACTION_ARRAY_REMOVE = ('array remove');
export const ACTION_ARRAY_ADD = ('array add');
