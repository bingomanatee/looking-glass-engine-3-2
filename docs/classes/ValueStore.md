# ValueStore

A ValueStore instance is a tree of values; it operates as a dictionary of streams, 
one per value -- Stream instances.  These work like fields in a Redux object. 

Additionally, there are virtuals that passively recalculate derived values. 

Lastly, actions are available that modify the value of ValueStores. They are optional,
as modifying ValueStores with external functions is identical to calling actions, but it 
is handy to have them hanging off the store. 

One of the value of using RxJS is you can control streams; toward this end you can group 
two or more changes into a single update using the block(fn) method. 

You can track changes in a subset of fields using the select method. 

## A note on terms

"props" "properties" "streams" are all the same thing - the list of values the store tracks. 
They are "properties" from an OOP point of view but they are *implemented* using streaming 
BehaviorSubjects in RxJS so they are also streams. 

## The Subscription pattern 

For those unfamiliar with the RxJS Observer syntax, "subscription" is the 
act of binding a listener to changes in an observable. Observables in RxJS are things that can emit.
This behavior like an event listener in DOM.
In its most simple form this is:

```javascript
const {timer, Subject} = require('rxjs');

const bomb =  timer(0, 100);
const sub = bomb.subscribe((index) => {
console.log(index);
});
/**
0
1
2
3
4
... and never stops
*/
```

the `.subscribe(listener(s))` has the return value of a subscription 
that has a single method, "unsubscribe"

```javascript
const sub = timer(0, 100).subscribe((index) => {
console.log(index);
if (sub && index > 3) {
  sub.unsubscribe();
}
});

/**
0
1
2
3
4
*/
```

Subscriptions take a function that a change value from a stream -- or, put 
another way, listens for values emitted from the stream. 

It also takes two other listeners optionally. 
Observables, like Promises, either end well
or do not. Unlike Promises, nothing is returned from the onComplete listener.

```
const {timer, Subject} = require('rxjs');

const bomb =  timer(0, 100);
const boomer = new Subject();
bomb.subscribe((value) => boomer.next(value));
// note - we are relaying to a Subject as timers don't provide the option to unsubscribe.

const sub = boomer.subscribe((index) => {
  console.log(index);
  if (sub && index > 3) {
    boomer.complete('boom');
  }
}, (err)=> console.error(err), (endValue) => {
  console.log('ended with a ', endValue);
});

/**
0
1
2
3
4
ended with a  undefined
*/

``` 

'boom' is not passed through to any listeners. 

the third listener listens for eny errors. An Observed error is not the same as a "catch" -
it's an intentionally thrown message that indicates a bad shut down. 
The first error shuts down the Observer, preventing further notification. even if you send 
`.next(data)` more things, once an error is called on a Subject, it stops broadcasting. 

```javascript
const {timer, Subject} = require('rxjs');

const bomb =  timer(0, 100);
const boomer = new Subject();
bomb.subscribe((value) => {
  console.log('bomb said', value);
  boomer.next(value);
});
// note - we are relaying to a Subject as timers don't provide the option to unsubscribe.

const sub = boomer.subscribe((index) => {
  console.log(index);
  if (index > 3) {
    boomer.error('boom');
  }
},
  (err)=> console.error('error:', err),
  (endValue) => {console.log('complete with a ', endValue);
});

/**
bomb said 0
0
bomb said 1
1
bomb said 2
2
bomb said 3
3
bomb said 4
4
error: boom
bomb said 5
bomb said 6
bomb said 7
bomb said 8...
*/
```

### TL;DR

mostly, simply subscribing with a single listening function will do what you want it to. 

## Constructor/creating ValueStore instances

The most basic form of a ValueStore is a list of values with no filtering:

```javascript
import {ValueStore} from '@wonderlandlabs/looking-glass-engine';

const store = new ValueStore({x: 0, y: 0, z: 0, })

store.subscribeValue((v) => console.log(v));
// {x: 0, y: 0, z: 0

store.do.setX(100);
// {x: 100, y: 0, z: 0}

store.do.setY(200);
// {x: 100, y: 200, z: 0}

```

As this shows, the streams named by the keys in the initial object are accessible through the 
proxy hook  `.my.[property]` 

and spawn setter methods off `.do.set[Property]`. 

### with actions

```javascript
const store = new ValueStore({x: 0, y: 0, z: 0, }, {scale: (s, num) => {
	s.do.setX(s.my.x * num);
	s.do.setY(s,my.y * num); 
	s.do.setZ(s.my.z * num);
  }
});

import {ValueStore} from '@wonderlandlabs/looking-glass-engine';

const store = new ValueStore({x: 0, y: 0, z: 0, })

store.subscribeValue((v) => console.log(v));
store.do.setX(100);
store.do.setY(200);
store.do.scale(3);
// {x: 300, y: 600, z: 0}
```

Actions you define are accessible off the `.do` proxy, 
and the argument list is prepended with a reference 
to the store itself. Do not use "this" in action definitions.

### with virtuals

The third, optional argument are virtuals. These are mixed in with the properties expressed in `.my` 
and are derivations of the properties of the store. Virtuals should be immutable and not trigger side
effects or change properties. 

```javascript
const store = new ValueStore({x: 0, y: 0, z: 0, }, {scale: (s, num) => {
	s.do.setX(s.my.x * num);
	s.do.setY(s,my.y * num); 
	s.do.setZ(s.my.z * num);
  }
}, {
	magnitude: [({x, y, z}) => Math.sqrt(x ** 2 + y ** 2 + z ** 2), 'x', 'y', 'z' ],
	normalized: [({x, y, z}) => {
		const scale = Math.sqrt(x ** 2 + y ** 2 + z ** 2) || 1;
		return {x: x / scale, y: y/scale, z: z/scale};
	}, 'x', 'y', 'z' ],
});

import {ValueStore} from '@wonderlandlabs/looking-glass-engine';

const store = new ValueStore({x: 0, y: 0, z: 0, })

store.subscribeValue((v) => console.log(v));
store.do.setX(100);
store.do.setY(200);
store.do.scale(3);
// {x: 300, y: 600, z: 0}
```

### Parametric construction

Instead of passing a wonky set of objects, you can call `.prop(..).action(...).prop(...).virtual(..)`
to define the store makeup. Personally I *prefer* this style of execution because you
can group related props and actions together. 

You can also write "factory" functions that take in stores and add functionality using
these definition functions. 

----
# Methods

## action
`.action(name: string, fn: function) : this`
adds an action to the `.do` proxy. 

Actions have a reference to the store instance prepended to its argument list,
and can take any number of arguments in addition. 

Actions can call other actions including the `set[Property]` actions, and can 
return a value. 

```javascript
const store = new ValueStore({x: 0, y: 0, z: 0, });

store.action('scale', (s, num) => {
    s.do.setX(s.my.x * num);
    s.do.setY(s,my.y * num); 
    s.do.setZ(s.my.z * num);
    })
.action('offset', (s, x = 0, y = 0, z = 0) => {
    s.do.setX(s.my.x + x);
    s.do.setY(s.my.y + y);
    s.do.setZ(s.my.z + z);
});

store.do.setX(10);
store.do.offset(5, 5, 5);
console.log('value: ', store.value); 
// {x: 15, y: 5, z: 5}

store.do.scale(2);
console.log('value: ', store.value); 
// {x: 30, y: 10, z: 10}
```

This is a supplelmental method - actions can also be defined, in bulk, 
with the second argument to the constructor. 

## block
`.block(fn: function): [err, result]`

execute a function during which no subscribers recieve changes until the completion 
of the action. This is useful for supressing unnecessary mid-stage notifications when multiple
values are changed, which reduces mid-stage renders in systems like React or Angular. 

Any thrown errors are trapped and returned as argument zero of the returned array. 

```javascript
const store = new ValueStore({x: 0, y: 0, z: 0, });

store.action('scale', (s, num) => {
    return s.block(() => {
        s.do.setX(s.my.x * num);
        s.do.setY(s,my.y * num); 
        s.do.setZ(s.my.z * num);
       });
    });
store.subscribeValue((v) => console.log(v));
// {x: 0, y: 0, z: 0}
store.do.setX(10);
// {x: 10, y: 0, z: 0}
store.do.setY(5);
// {x: 10, y: 5, z: 0}
store.do.setZ(30);
// {x: 10, y: 5, z: 30}
store.do.scale(2);
// {x: 30, y: 10, z: 60}

```

note-without the block wrapper, each setX, setY, or setZ called inside the action
would trigger a distinct subscriber alert. 

## broadcast
* `.broadcast()`
This method is ordinarily triggered by change in state; but it does force
a re-notification to all subscribers of the stores' current state. 

## complete
* `.complete()`

Terminates the subject, and freezes all further subscription notifications. 

## pre
* `.preProcess(name, fn)`
Adds a function to a named stream that returns an altered version of the input 
every time a stream is set. 

note - if you want to *block* bad values from being submitted you can write a preProcess
function that throws an error when an unacceptable value is passed in. 
```javascript

const store = new ValueStrem({firstName: ['', 'string'],
lastName: ['', 'string']
});

const toUpper = (s) => {
  if (!(typeof s === 'string')) return '';
  return _.upperFirst(s);
};
store.preProcess('lastName', toUpper);
store.preProcess('firstName', toUpper);

store.subscribeValue((v) => console.log(v));

store.do.setLastName('roberts');
// {firstName: '', lastName: 'Roberts'}
store.do.setFirstName('bob');
// {firstName: 'Bob', lastName: 'Roberts'}
```

## stream
* `.stream(name, value)`
* `.stream('name, value, pre?, post? comparator?)`
*alias: property* for backwards compatibility
creates a stream 

# select
* `.select(propName:string, propName: string...) : Subject`
returns a stream that observes changes in a subset of the stores' properties. 
you can call subscribe on the resulting Subject: 
`store.select('x', 'y').subscribe((state) => console.log('state is ', state))`
# selectValues
* `.selectValues(propName:string, propName: string...) : Subject`
same as select, but instead of returning the full metadata for each property,
returns the properties' current value. 

# subscribe
* `.subscribe(onChange, onError, onDone)`
Listen for changes in the subject (BehaviorSubject)
# subscribeValue
* `.subscribeValue(onChange, onErr, onDone)`
listens to properties/virtuals; but boils down properties to their current values (aka the `value` property),
ignoring meta/filters and lastValid.
# values
* `.values(propName, propName...)`
# virtual()
* `.virtual(name, fn: function): {self}`
* `.virtual(name, fn: function, fieldName... : string): {self}`
creates a virtual property that calculates a value based on one or more props. 
The first value the function is passed is an object summary of a set of properties, which are the third 
and subsequent arguments to the `virtual(..)` function. The second argment is the store itself, 
so if you want to be lazy you can compute off `store.my.[prop]`. 

The function of a virtual should not have side effects; that is it shouldn't set any property values,
or do anything other than return a value; that is, it should be 'pure'.
----
# Properties

## do 
* `.do: (proxy)`
a Proxy (1) that has as its props: 

1. all the setters for the defined streams
2. any actions you define with the second object or the `.action(...)` method

note - all setters return an array of metas -- unless they are empty so if you want to 
respond to errors immediately, you can:

```javascript
if (const [err] = store.setX(x)) throw err;
```

## my
* `.my: (proxy)`
a Proxy (1) that has as its properties the current value of the streams

## propNames
* `.propNames: [{string}...]`
an array of the names of the properties (strings) in the order in which they were created. 

## props
* `.props {proxy}`
properties/streams are stored internally as a Javascript Map. 
`props` coerces them into an object. 
## streams
* `.streams: {Map}` (readonly)
the Stream instances created from the properties defined in the constructor 
or with the `.property(...)` method
## subject
* `.subject: {BehaviorSubject}`
The source of updates. `store.subject.subscribe(listener...)` is equal to `store.subscribe(listener)`.
## subjectValue
A BehaviorSubject that returns the raw value of each stream; the provider for `.subscribeValue`
## value
* `.value {Object}`
An object summarizing the current value of all props, and the virtual values. 

----

* (1) if proxies are not available in the environment an analogous object is created
