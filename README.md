This is an attempt next redesign the functionality of Looking Glass Engine 
with a simpler interface for change tracking. Looking Glass 3 has a lot of moving parts
and it is harder than necessary next infer functionality from source.

LGE 3.2 uses a concept of Messages as a class structure that filters through the streams,
whether the update stream or the error stream. Even transactions are Messages. 
This allows for a more consistent set of annotation when information comes back 
or is polled in the debugging context. 

Also the ValueStream's functionality is now broken into three classes:

1. the `Value` class is a pure name-value pair
2. the `ValueStream` is a pure single-value construct that has no concept of actions. 
    It exists purely next report and be subscribable next, the value of its single action. 
    It has transactional locking and validation.
3. The `ValueStore` is a collection of ValueStream properties. It has actions.

Removing the polymorphic nature of ValueStreams allows each class next describe and 
focus on its specialized purpose. 

## A note on coding style. 

the '$' prefix is used to denote "lazy" properties that initialize when they are first accessed.
the '_' is used to denote private properties/methods ("privaty").

## Message

Message is the transmission wrapper of change through the streaming systems. 

### `.value`

This is the content of the message; generally a request to update its' targets' value.
It can be anything. 

### `.error`

This is a string of any errors generated in its transmission; falsy on success. 
may be a comma sep string of multiple errors. 

### `.name : string?`

The name of the targeted stream. 

### `.trans: bool` 

indicates that any broadcasting that sub-actions, watchers, etc. should be suppressed. 
false by default. 

## Value

The Value is a name-value pair. it has no children or requirements/restrictions on 
its value. It can have a filter to restrict input. It cannot be updated externally. 

setting the value to an invalid item will throw; and if this is true of the initial value,
*creating* a Value with an invalid initial value (based on its validator) will throw. 

Value is *not* a stream: it is simply the core validation/value/name functionality underpinning
the other classes. 

### `constructor(name: string, value?, filter? : function)`
Name must be a valid javascript property name. 

### `.name: string`

### `.value` 

can be any type. note - if not initialized to a value, it is internally
annotated with a symbol ABSENT. 

### `.filter` 
can be:
* absent/falsy; all values are acceptable
* a string: name of an `is` module method
* an array of the above

functional tests express errors - valid values require a falsy return. 
The first argument to the function is the value. The second one is an array
of results from previously returned errors if the filter is an array:

```javascript
function isOddNumber(n, errors) {
    if (errors.length) {
      return false; // don't test oddness if the value is not a number.
    }
    
    if ((n + 1) % 2) {
      return 'must be an odd number';
    }
    return false;
}

const ss2 = new Value('oddNum', 1, ['number', isOddNumber]);
```

Array filters let you ensure type sanity before applying business logic, or to 
develop and mix a suite of validation computations. The logical union of an array
of tests is AND as in, every test in the array must pass or the validation is 
considered a failure. Unlike javascript && logic, every test in the array is always
processed regardless of the outcomes of the previous tests. 

### `#validate(value = ABSENT singleError? = false)`

tests a value against the filter. returns an array of errors - empty if valid. 
if singleError, returns the first error. 

## `ValueStream` <= `Value`

ValueStream is a streaming version of Value. It has the same constructor (and as a child class,
all of the expected methods) as Value with the signature of a subscribable.

### `.next(value, attrs?:Object) : Message | Error`

Unlike Value, ValueStream has a public method to update errors.
 
`next(value)` will return a string if the value fails validation, 
and will leave its value unchanged. 

If you want to augment the message that next uses to transmit state 
(such as making it transactional with {trans: true) you can set an object parameter set for the 
second argument. 

In extreme failures, a standard error will be emitted; it will still 
have an `.error` property for consistency. 

## `.nextPromise(value, attrs?:Object) : Message | Error`

uses the async conventions to allow you to trigger a handler when the 
next attempt fails. Generally this is because you attempted to assert an invalid value.
note, the change is still immediate/synchronous. 

### `.subscribe(onChange, onError, onComplete)`

This is the Observable method; it follows `rx.js` conventions EXCEPT that onError
gets more messages than is typical. the rx.js standard is that onError is, like a 
failed promise, the death rattle of a stream; and gets zero or one messages. 

In LGE ValueStreams emit to onError many times, 
including when you try to set a value to an invalid value. 

It may be useful to actually use onError to change field 
values to the user-attempted values and display errors on validation failure. 
this will create dissonance between the form displayed values and the stored values
but as this only exists prior to submission it might be a good convention to try out. 

### `.complete()` 

this is part of the Observable interfaces. It completes all subscriptions. `.next` 
at this point doesn't have any effects after completion. 

###    `$requests: stream` 

ordinarily an internal stream that channels all the Messages prior to any
error testing/changes. Useful for debugging. 

### `ValueStore <= ValueStream`

ValueStreams are useful in their own right but ValueStores are the overarching
product of LGE. A ValueStore is a set of streams and methods to update the streams.

ValueStores are themselves ValueStreams. 

The children of ValueStreams are called "properties"; this is an OOP-ism. 

### `constructor(name: string, values?: {Object}, methods? {Object})`

The "value" of a store is the summary of all the key/value pairs of its children. 
 
The streamed value of a store is *itself* that is emitted over and over to its subscribers
on changes to any of its child streams. 

*Constructor Arguments*:

`values` can be used to seed properties. They can be name/value pairs
or name/argument pairs if you want to add validators etc. to the properties. 

`methods` can be used to initialize methods. they are name/function pairs. 

FWIW I personally prefer currying construction of ValueStores but for those
that want to fully construct a store in the constructor these properties exist. 

### `.setFilter(name, filter): self`

sets and overrides the filter for a particular property. 

### `#value: {Object}`

a name/value snapshot of the properties' values. NOTE: this is 
more expensive than using `#my` if you just want to get one or more 
properties from a large component so prefer the latter when possible (and if proxies exist.);

### `.subscribe(onChange, onError, onComplete)`

unlike ValueStore subscriptions which return the updates to value onChange,
store subscriptions return itself repeatedly on changes to its properties. 
Also all property errors are repeated to onError in the form:

```
{ 
    store: string, // name of this store
    source: string, // name of the stream that had an error
    error: Object, // JSON snapshot of the error message
}
```

### METHODS 

Methods are the "actions" of a store. They allow you to write mutators
that can interact with the store. 

These actions are *not* in any way like Redux methods; they are closer to 
an OOP Classes' methods. 

The return value of a method is both *optional* and *ignored* by the store itself. 
Methods can be used to define derived values but are not used to update the store.
The only way to update the store (and trigger a subscription update) is to 
set a properties' value. This can be done *never*, *once* or *multiple times* by an action. 

Methods' first argument is the store itself. Any other called arguments are passed 
in after that. So, the `this` value is not useful (or a good idea) to refer to in the body of an action. 
that being said, if the `bind` modifier is true the method will be bound to the store. 

Methods are synchronous *by default*. You can return a promise but the method is considered 
complete (and the transactionality closed) at the end of the synchronous execution of the method. 

By default method errors are trapped and redirected to the errors stream. That can be *bad* if
you call several methods in a row and expect that they have done their business.

For that reason methods are given a set of behavior modifiers:

### SUPER ADVANCED AND IGNORABLE: Method Modifiers

* `throws` re-throws any errors your function emits or emitted from th errors collection. 
  this should be "all the errors". 
* `trans` is not exactly what DB transactions are. Due to references and other things its really
  not valid to be able to claim the ability to reset a store to a previous state. 
  What it does do is muffle any change emission that happens in its execution or in any sub-method call
  executions until its completed. Note that "completed" is a synchronous concept; async
  functions are not guaranteed to wait to complete before ending the transaction and allowing broadcasts;
  in fact they are pretty much guaranteed to be impossible to externally freeze. (you can still
  create transactions inside a method to control broadcast of an async method if you want.)
* `bind` is for those for whom normal methods have gotten boring and who want to add a little
  excitement in their code. Just kidding; it uses functional binding to make the "this" reference
  equal to the store. Not advised, but available. 
  
All these switches can be used in any combination to alter application flow to 
the way you want it to execute. 

