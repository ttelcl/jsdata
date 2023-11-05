# jsdata / json-reshape

# Purpose

This tool implements a JSON remapping tool, taking a JSON file as input, and 
keeping only parts that match a model.
The model is provided by your calling code (see `index.js` for an example).

# Source File guide

The following files are included:

* `README.md` this documentation file
* `json-reshape.js` The main functionality
* `index.js` An example of how to use this tool
* `package.json` A bare-bones node.js project file

The code has been developed with the current LTS version of node.js
in mind (v20.9.0). There are currently no external dependencies, so
there is no need to "npm install".

# Synopsis

```
node index.js -f input.json
node index.js -f input.json output.json
node index.js -m model -f input.json output.json
```

`-f input.json`

Specifies the input file and generates an output file name based on the input 
and the model. 

`-f input.json output.json`

Specifies the input file and the output file. 

`-f input.json -`

Specifies the input file and prints the output to stdout. 

`-m model`

Specifies the model to use for subsequent data files (`-f` options). The models
available are provided by you as a "library" of named models. Before the
first `-m` option the selected model is the model named "`default`".

# Operation

The intended use of this "half-app" is that you write an entry point JS file
similar to `index.js` that defines one or more models to match and then calls

```javascript
runTransformApplication(modelLibrary, [...process.argv])
```

This call handles command line parsing, loading data and writing the output.

# Models

Each models is defined as a JavaScript model of the JSON output. The structure
of objects and arrays is copied from the input (skipping input fields that are
not named in the model). A primitive value in the model is just an indicator of
the type of data expected: a string in the input is copied to the output if the
model has any string in that position (the value of the string doesn't matter,
so use a plain `""` to keep it simple). Similar rules apply for numbers and
booleans. Mismatched values are not copied.

## Matcher functions

In addition to literals (be they primitives or composites) you can also use
function values to provide more powerful matching and transformation options.
The `match` and `makeMatch` namespace objects in `json-reshape.js` provide
collections of functions designed to be used for this purpose.

More functions will be added to the `match` and `makeMatch` namespaces in the future.

### Direct matcher functions (match.*)

The `match` namespace contains functions that are match functions themselves,
that can be included in your model directly (that is: you just include their
name, you don't invoke them).

| name | description |
| --- | --- |
| `match.string` | A matcher that only matches string values. Equivalent to specifying a string. |
| `match.number` | A matcher that only matches numbers. Equivalent to specifying a number |
| `match.boolean` | A matcher that only matches booleans. Equivalent to speciying `true` or `false` |
| `match.null` | A matcher that only matches null. Equivalent to speciying `null` |
| `match.fail` | A matcher that does not match anything. Can be used to explicitly not copy a field that otherwise would be copied |

### Indirect matcher functions (makeMatch.*)

The `makeMatch` namespace contains functions that return a matcher function
as their result. This indirection allows passing arguments such as explicit models
to guide the matching and projection process in ways that plain matchers can't.
The matcher functions returned by these matcher factory functions typically have
their model already "baked in", and they just ignore the model passed
by the matcher call (that model that is passed in the call is the matcher
function itself, using it would just lead to infinite recursion).

| name | description |
| --- | --- |
| `makeMatch.object(model)` | Returns a matcher matching the argument object model. Equivalent to specifying that object model directly |
| `makeMatch.array(model)` | Returns a matcher matching the argument array model, inserting matching elements into the result array and dropping not-matching elements. Equivalent to specifying that array model directly |
| `makeMatch.flatten(model)` | Returns a matcher that returns a _merge function_ (see below) which takes the usual output from matching the model object and inserts it in the host object, using property names calculated from combining the host property name and the child property names |

## Merge functions

A matcher function can return one of the following:

* Undefined
* A plain JSON compatible item: string, number, boolean, null, object, array
* A _merge function_.

Returning a _merge function_ (or more correctly: a _bound merge function_) 
allows inserting the result of the match / projection into the parent object
or array in ways other than setting the value of the property being matched
to the match result or appending the matched objects to the array.

### Bound merge functions

A _bound merge function_ has the prototype `(MergeArguments) => void`,
where `MergeArguments` is either `{hostArray: any[]}` for array merges or
`{hostObject:Object,hostKey:string}` for object merges. Note that the
value to be merged is not available as an argument, it should be present
(_bound_) in the function already.

A _bound merge function_ defines two aspects:
* The functionality of how the projected content is to be merged into the host object or host array
* The projected content itself

In practice these two aspects are coded separately, and combined into a lambda
by the `bindMergeFunction()` utility function. The functionality part is
defined by an _unbound merge function_.

### Unbound merge functions

An _unbound merge function_ has the prototype `(MergeArguments,value) => void`.
That is: it is similar to a _bound merge function_, but takes the value to
be merged as an explicit argument.

The `unboundMerge` namespace provides some predefined unbound merge functions
(which are also exposed as wrapped by matcher factory functions in `makeMatch`)

| name | description |
| --- | --- |
| `flatten` | This is the core that implements `makeMatch.flatten()` functionality. |
