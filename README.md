# jsdata

# Purpose

This tool implements a JSON remapping tool, taking a JSON
file as input, and keeping only parts that match a model.
The model is provided by your calling code (see `index.js` for an example).

# Synopsis

```
node index.js -f input.json
node index.js -f input.json output.json
node index.js -m model -f input.json output.json
```

`-f input.json`

Specifies the input file and generates an output file
name based on the input and the model. 

`-f input.json output.json`

Specifies the input file and the output file. 

`-f input.json -`

Specifies the input file and prints the output to stdout. 

`-m model`

Specifies the model to use for subsequent data files
(`-f` options). The models available are provided by you
as a "library" of named models. Before the first `-m`
option the selected model is the model named "`default`".

# Operation

The intended use of this "half-app" is that you write an
entry point JS file similar to `index.js` that defines one
or more models to match and then calls

```javascript
runTransformApplication(modelLibrary, [...process.argv])
```

This call handles command line parsing, loading data and
writing the output.

# Models

Each models is defined as a JavaScript model of the
JSON output. The structure of objects and arrays is copied
from the input (skipping input fields that are not named
in the model). A primitive value in the model is just an
indicator of the type of data expected: a string in the
input is copied to the output if the model has any string
in that position (the value of the string doesn't matter,
so use a plain `""` to keep it simple). Similar rules apply
for numbers and booleans. Mismatched values are not copied.

In addition to literals (be they primitives or composites)
you can also use function values to provide more powerful
matching and transformation options. The `trx` object in
`js-trx.js` provides a collection of functions designed to be 
used for this purpose.

| name | description |
| --- | --- |
| `trx.string` | A matcher that only matches string values. Equivalent to specifying a string. |
| `trx.number` | A matcher that only matches numbers. Equivalent to specifying a number |
| `trx.boolean` | A matcher that only matches booleans. Equivalent to speciying `true` or `false` |
| `trx.fail` | A matcher that does not match anything. Can be used to explicitly not copy a field that otherwise would be copied |
| `trx.object(model)` | A function that returns a matcher matching the argument object model |
| `trx.array(model)` | A function that returns a matcher matching the argument array model |

More functions will be added to `trx` in the future.


