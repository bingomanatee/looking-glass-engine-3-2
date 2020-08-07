## 3.2.0

Recoded entire code base; 
spread functionality through a layer of classes for "easier" digestion/testing.
major features add include virtuals, expanded watch, and more nuanced methods.

* removed 'is' passthroughs
* watch now takes one or more fields to watch
* added virtuals - lazy computed values that derive from data. 
* expanded use of Proxies. 
* added gitdocs documentation tree
* added more options when creating methods, allowing them to throw and/or be transactional.
* added throwing versions of the set methods. 

## 3.2.1

fixed a quirk in watch where serializer was undefined. 

# 3.2.2

ensured symmetry in property/method definition; addProperty === property, addMethod === method

# 3.2.4

Allowed objects as validators for the purpose of developing formal

# 3.2.5

updated lodash reflecting github security prompt;
reflected 'is' package is no longer a dependency outside the tests

# 3.3.0

A complete rebuild; transporting sometimes use features like filters (now meta) and blocking into utility classes. 

* Eliminated use of lodash for size minimization
* Using @wonderlandlabs/validation for reduction of type validation features
* Redesigned emissions model to allow for submission of invalid values. 
* Errors renamed meta for a host of use cases including errors, annotation. 

