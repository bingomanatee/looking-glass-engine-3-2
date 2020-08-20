# Blockers

These are advanced functionality that should be used with extreme care. 

Why?

Because they can paralyze your feedback streams and bring your store to a screeching halt.  

So if they're so dangerous why use them? because 

> DANGER IS MY LAST NAME! --- Carlos Danger

a "block" is a function that is executed during which no broadcasting of updates happens
until the routine is finished. note: the function must be synchronous - async or promise
based blocks may "unblock" before you are prepared to.

`.block(...)`, the method, returns an array of two values: [error, output];

the error is any thrown error the function may have generated; output is the return value (if any)
from the passed in function. 
