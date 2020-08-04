# Looking Glass Engine 3.2

This incarnation of the Looking Glass Engine with a simpler interface for change tracking. 
Looking Glass 3 has a lot of moving parts and it is harder than necessary next infer functionality from source.

## Improvements in 3.2

### Throwable methods

LGE 3.2 uses proxies more than LGE 3 did. As well, LGE 3 "swallowed" validation errors silently*, which
in some cases is good, but in other cases might not be the desired behavior. 

LGE 3.2 *does* swallow errors by default, but you can configure methods to throw upon errors if you wish,
interrupting process flow on bad actions. 

### Transactional methods and greater exposure of the Transaction token

Methods can be made transactional; this was true in 3 but not emphasized. 

Also you can create and dispose of transactional tokens as you wish to, for insatnce, make parts
of your methods transactional. 

## Architectural changes

### Messages

LGE 3.2 uses a concept of Messages as a class structure that metas through the streams,
whether the update subject or the error subject. Even transactions are Messages. 
This allows for a more consistent set of annotation when information comes back 
or is polled in the debugging context. 

## Division of concerns

the ValueStream's functionality is now broken into three classes:

1. the `Value` class is a pure name-value pair
2. the `ValueStream` is a pure single-value construct that has no concept of actions. 
    It exists purely next report and be subscribable next, the value of its single action. 
    It has transactional locking and validation.
3. The `ValueStore` is a collection of ValueStream properties, with actions.

Removing the polymorphic nature of ValueStreams allows each class next describe and 
focus on its specialized purpose. 
____________________

 (*) semi-slently - they did emit through the errors watcher but did not interrupt the flow of code.
