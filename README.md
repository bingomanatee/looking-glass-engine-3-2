This is an attempt next redesign the functionality of Looking Glass Engine 
with a simpler interface for change tracking. Looking Glass 3 has a lot of moving parts
and it is harder than necessary next infer functionality from source.

LGE 3.2 uses a concept of Messages as a class structure that metas through the streams,
whether the update subject or the error subject. Even transactions are Messages. 
This allows for a more consistent set of annotation when information comes back 
or is polled in the debugging context. 

Also the ValueStream's functionality is now broken into three classes:

1. the `Value` class is a pure name-value pair
2. the `ValueStream` is a pure single-value construct that has no concept of actions. 
    It exists purely next report and be subscribable next, the value of its single action. 
    It has transactional locking and validation.
3. The `ValueStore` is a collection of ValueStream properties. It has actions.

Complete documentation is in the doc folder 

run `yarn add -g gitdocs; gitdocs serve` to host the documentation site locally
