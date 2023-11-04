import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  renameSync,
  existsSync,
} from 'node:fs';

/**
 * Function that tries to match the actual data to the given model,
 * returning the projected data on success, or undefined if not matched
 * @typedef {(data: any, model: any) => any} matchFunction
 */

/**
 * @typedef {Object} Transformation
 * @property {string} modelName
 * @property {string} inputFile
 * @property {string} outputFile
 */

/**
 * Arguments to a "merge" function. Note that the value to be bound is NOT
 * part of this
 * @typedef {Object} MergeArguments
 * @property {any[]} [hostArray] The array to merge into, when merging into an array.
 * Mutually exclusive with hostObject
 * @property {Object.<string,any>} [hostObject] The object to merge into, when merging into
 * an object. Mutually exclusive with hostArray. Must be accompanied by hostKey
 * @property {string} [hostKey] The name of the property in the hostObject that would
 * be set in the "plain" merging case. The plain case would be (hostObject[hostKey] = value) 
 */

/**
 * A function that merges a child value into an object or array host.
 * It is up to the function to define "merging". A default case would be
 * to set hostObject[hostKey] to value for objects, or to hostArray.push(value)
 * for arrays, but implementations can choose other interpretations, such
 * as conditionally not doing anything at all, merging child properties in the
 * host, renaming the hostKey, or anything else.
 * The value to be merged is already bound into this function
 * @typedef {(MergeArguments) => undefined} boundMergeFunction
 */

/**
 * An unbound merge function, representing the actual merging function invoked
 * by a bound merge function.
 * @typedef {(args:MergeArguments,value:any) => undefined} unboundMergeFunction
 */

/**
 * Bind an unbound merge function to a value, returning the resulting bound merge function
 * @param {unboundMergeFunction} umf
 * @param {any} value 
 * @returns {boundMergeFunction}
 */
export function bindMergeFunction(umf, value) {
  if (value === undefined) {
    throw new Error(`Not expecting an undefined value here`)
  }
  if (typeof(value) === "function") {
    throw new Error(`Not expecting a function value`)
  }
  return (args) => umf(args, value)
}

/**
 * Extended version of typeof(), furthe distinguishing "object" into
 * "null", "array" and "object"
 * @param {any} value 
 * @returns {string}
 */
export function typeofEx(value) {
  const t0 = typeof (value)
  switch (t0) {
    case "object":
      return value === null ? "null" : Array.isArray(value) ? "array" : "object"
    default:
      return t0
  }
}

function projectObject(data, model) {
  if (data === null || typeof (data) !== "object" || Array.isArray(data)) {
    return undefined;
  }
  if (model === null || typeof (model) !== "object" || Array.isArray(model)) {
    throw new Error("Expecting a model that is an object")
  }
  const result = {}
  for (const [key, modelValue] of Object.entries(model)) {
    const dataValue = data[key]
    if (dataValue !== undefined) {
      const projectedValue = projectAny(dataValue, modelValue)
      if (projectedValue !== undefined) {
        if (typeof (projectedValue) === "function") {
          // assume it is a boundMergeFunction
          projectedValue({hostObject: result, hostKey: key})
        } else {
          result[key] = projectedValue 
        }
      }
    }
  }
  return result
}

/**
 * Project an input array to an array of elements matching one of the models
 * @param {any[]} data The data array to project
 * @param {any[]} model The array of models to probe for mapping
 * @param {boolean} nullIfNotMatching If true, non-matching data elements are replaced by
 * null instead of being skipped altogether
 * @returns {any[] | undefined}
 */
function projectArray(data, model, nullIfNotMatching) {
  if (data === null || typeof (data) !== "object" || !Array.isArray(data)) {
    return undefined;
  }
  if (model === null || typeof (model) !== "object" || !Array.isArray(model)) {
    throw new Error("Expecting a model that is an array")
  }
  const result = []
  for (const dataValue of data) {
    let projected = undefined
    for (const modelValue of model) {
      projected = projectAny(dataValue, modelValue)
      if (projected !== undefined) { break }
    }
    if (projected !== undefined) {
      if (typeof(projected) === "function") {
        // assume it is a boundMergeFunction that supports arrays
        projected({hostArray: result})
      } else {
        result.push(projected)
      }
    } else if (nullIfNotMatching) {
      result.push(null)
    }
  }
  return result
}

/**
 * Find the appropriate matcher function to match the
 * (top level of) the given model.
 * @param {any} model 
 * @returns {matchFunction}
 */
function getModelMatcher(model) {
  const modelType = typeofEx(model)
  switch (modelType) {
    case "function":
      // The "model" is itself a matcher function
      return model;
    case "string":
      // The model only matches when the data is a string
      return trx.string;
    case "number":
      // The model only matches when the data is a number
      return trx.number;
    case "boolean":
      // The model only matches true or false
      return trx.boolean;
    case "array":
      // The model only matches an array, and the data is projected
      // to the specification of the content in the model array
      return trx._array;
    case "object":
      // The model only matches an object (that is not null nor an array),
      // and the data is projected to the specification of the content in
      // the model object
      return trx._object;
    case "undefined":
      // Returns a matcher that always fails
      return trx.fail;
    case "null":
      throw new Error("Model objects do not support 'null' directly")
    default:
      throw new Error(`Unexpected model type "${modelType}"`)
  }
}

/**
 * Try to project the data to the model. This may return undefined,
 * a primitive value, an array, an object, or a merge function.
 * @param {any} data 
 * @param {any} model 
 * @returns {any}
 */
function projectAny(data, model) {
  const matcher = getModelMatcher(model);
  const result = matcher(data, model);
  return result;
}

/**
 * Project a data object to the named model selected from the given
 * model library
 * @param {any} data The data to project
 * @param {Object.<string,any> | any} modelOrLibray A map from model names to models, or the
 * model itself if modelName is undefined.
 * @param {string | undefined} modelName The name of the model (if undefined, modelOrLibrary
 * is interpreted as the model itself)
 * @returns {any} The projected data
 */
export function projectToModel(data, modelOrLibrary, modelName) {
  const model = modelName === undefined ? modelOrLibrary : modelOrLibrary[modelName]
  if (model === undefined) {
    const modelNames = Object.keys(modelOrLibrary).join(", ")
    throw new Error(`Unknown model "${modelName}". Known model names are: ${modelNames}`)
  }
  return projectAny(data, model);
}

/**
 * A collection of transformation functions for use in your
 * models.
 */
export const trx = {
  string: function (value, model) {
    if (typeof (value) === "string") {
      return value;
    }
    return undefined;
  },

  number: function (value, model) {
    if (typeof (value) === "number") {
      return value;
    }
    return undefined;
  },

  boolean: function (value, model) {
    if (typeof (value) === "boolean") {
      return value;
    }
    return undefined;
  },

  _object: function (value, model) {
    if (typeof (value) === "object" && !Array.isArray(value)) {
      return projectObject(value, model);
    }
    return undefined;
  },

  _array: function (value, model) {
    if (typeof (value) === "object" && Array.isArray(value)) {
      return projectArray(value, model, false)
    }
    return undefined;
  },

  fail: function (value, model) {
    return undefined;
  },

  /**
   * This is not a matcher itself, but calling it returns a matcher
   * function that matches the model object
   * @param {Object.<string,any>} model 
   */
  object: function (model) {
    return (value, ignored) => trx._object(value, model)
  },

  /**
   * This is not a matcher itself, but calling it returns a matcher
   * function that matches the model array
   * @param {any[]} model 
   */
  array: function (model) {
    return (value, ignored) => trx._array(value, model)
  },

  /**
   * Create a matcher function that flattens the intermediate object created
   * by matching the intermediate model into the host object
   * @param {Object.<string,any>} model The model for the intermediate object
   * @returns A matcher function that in turn either returns a bound
   * merge function or undefined.
   */
  flatten: function (model) {
    return (value, ignored) => {
      const value2 = trx._object(value, model)
      if (value2 === undefined) {
        return undefined
      } else {
        return bindMergeFunction(flattenUnbound, value2)
      }
    }
  },


}

/**
 * The unbound merge function backing the "flatten" functionality
 * @param {MergeArguments} args 
 * @param {any} value 
 */
function flattenUnbound(args, value) {
  if (value === undefined) {
    throw new Error(`Not expecting value 'undefined' here. Did you try to call this without binding?`)
  }
  const {hostObject, hostKey} = args
  if (!hostObject || !hostKey) {
    throw new Error(`Expecting a host object to merge data into and a key ("flatten" can only be used in objects, not arrays)`)
  }
  for(const [k,v] of Object.entries(value)) {
    hostObject[`${hostKey}-${k}`] = v
  }
}

// ------------------------------------------------------------------------

/**
 * Parse arguments. Currently the only supported arguments are of
 * the shapes "-f input.json output.json" and "-f input.json"
 * @param {string[]} args The arguments to parse
 * @returns {Transformation[]}
 */
export function parseArguments(args) {
  args = [...args] // clone, se we do not modify the argument itself
  const results = []
  let modelName = "default"
  while (args.length > 0) {
    const arg = args.shift()
    if (arg === "-m") {
      modelName = args.shift()
    } else if (arg === "-f") {
      if (args.length > 0) {
        const inputFile = args.shift()
        const extensionIndex = inputFile.lastIndexOf(".")
        if (extensionIndex < 0) {
          throw new Error(`Expecting file name to have an extension`)
        }
        if (args.length > 0 && (!args[0].startsWith("-") || args[0] === "-")) {
          const outputFile = args.shift()
          results.push({ modelName, inputFile, outputFile });
        } else {
          const extension = inputFile.slice(extensionIndex)
          const prefix = inputFile.slice(0, extensionIndex)
          const outputFile = prefix + "." + modelName + ".out" + extension
          results.push({ modelName, inputFile, outputFile });
        }
      } else {
        throw new Error(`Expecting a file name after "-f"`)
      }
    } else if (arg.endsWith("node.exe")) {
      const script = args.shift()
      // ignore
    } else {
      throw new Error(`Unexpected argument "${arg}"; expecting "-f" or "-m"`)
    }
  }
  return results
}

/**
 * Load an existing JSON file
 * @param {string} filename 
 * @returns {any}
 */
export function loadJson(filename) {
  return JSON.parse(readFileSync(filename, "utf8"))
}

/**
 * Save data to a JSON file. If the target file exists a backup
 * of the existing content is made first
 * @param {string} filename The name of the file to save
 * @param {string | any} data The data to save, either as a pre-formatted JSON string,
 * or as some item to be converted to JSON
 */
export function saveJson(filename, data) {
  if (existsSync(filename)) {
    const bakName = filename + ".bak"
    if (existsSync(bakName)) {
      rmSync(bakName)
    }
    renameSync(filename, bakName)
  }
  if (typeof (data) !== "string") {
    data = JSON.stringify(data, null, 2)
  }
  writeFileSync(filename, data) // UTF8 is default
}

/**
 * 
 * @param {any} modelLibrary The library that maps model names to models.
 * At the minimum this should contain a model named "default"
 * @param {string[] | undefined} args The application arguments providing
 * input and output files. If null, process.argv is used
 */
export function runTransformApplication(modelLibrary, args) {
  args ??= [...process.argv]
  const transformations = parseArguments(args)
  if (transformations.length == 0) {
    console.warn("No inputs provided")
    console.log("Usage:")
    console.log("  node <?>.js {[-m <model>] {-f <input.json> [<output.json>]}}")
    const modelNames = Object.keys(modelLibrary).join(", ")
    console.log(`Known model names are: ${modelNames}`)
  } else {
    for (const { modelName, inputFile, outputFile } of transformations) {
      const model = modelLibrary[modelName]
      if (!model) {
        console.error(`  Unknown model "${modelName}". Skipping input "${inputFile}"`)
      } else {
        console.log(` Processing "${inputFile}" (using model "${modelName}")`)
        const data = loadJson(inputFile)
        const projected = projectToModel(data, modelLibrary, modelName)
        const json = JSON.stringify(projected, null, 2)
        if (outputFile === "-") {
          console.log(json)
        } else {
          console.log(`    Writing "${outputFile}"`)
          saveJson(outputFile, json)
        }
      }
    }
  }
}
