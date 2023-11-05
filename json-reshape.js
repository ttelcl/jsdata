import {
  readFileSync,
  writeFileSync,
  rmSync,
  renameSync,
  existsSync,
} from 'node:fs';

/**
 * Function that tries to match the actual data to the model implied
 * by this function, returning the projected data or a merge function 
 * on success, or undefined if not matched
 * @typedef {(data: any) => any} matchFunction
 */

/**
 * Arguments to a merge function. Note that the value to be merged is NOT part of this
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
  if (typeof (value) === "function") {
    throw new Error(`Not expecting a function value`)
  }
  return (args) => umf(args, value)
}

/**
 * Extended version of typeof(), further distinguishing "object" into
 * "null", "array" or "object"
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
          projectedValue({ hostObject: result, hostKey: key })
        } else {
          result[key] = projectedValue
        }
      }
    }
  }
  return result
}

/**
 * Project an input array to an array of elements matching one of the models.
 * The child models are tried in order, until a match is found
 * @param {any[]} data The data array to project
 * @param {any[]} model The array of models to probe for mapping
 * @param {(any) => any} [transform] Optional transformation of
 * child match results, applied to a matching child transform result
 * before deciding if it really matched.
 * @param {boolean} [nullIfNotMatching] If true, then insert null
 * for any unmatched elements (so the result array has the same
 * length as the input)
 * @returns {any[] | undefined}
 */
function projectArray(data, model, transform, nullIfNotMatching) {
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
      if (transform) {
        projected = transform(projected)
      }
      if (projected !== undefined) { break }
    }
    if (projected !== undefined) {
      if (typeof (projected) === "function") {
        // assume it is a boundMergeFunction that supports arrays
        projected({ hostArray: result })
      } else {
        result.push(projected)
      }
    } else if (nullIfNotMatching === true) {
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
      return match.string;
    case "number":
      // The model only matches when the data is a number
      return match.number;
    case "boolean":
      // The model only matches true or false
      return match.boolean;
    case "array":
      // The model only matches an array, and the data is projected
      // to the specification of the content in the model array
      return (data) => projectArray(data, model);
    case "object":
      // The model only matches an object (that is not null nor an array),
      // and the data is projected to the specification of the content in
      // the model object
      return (data) => projectObject(data, model);
    case "undefined":
      // Returns a matcher that always fails
      return match.fail;
    case "null":
      return match.null;
    default:
      throw new Error(`Unexpected model type "${modelType}"`)
  }
}

/**
 * Try to project the data to the model. This may return undefined,
 * a primitive value, an array, an object, or a merge function.
 * @param {any} data The data to match and project
 * @param {any} model The model to match to
 * @returns {any} The result of the match and project operation:
 * undefined to indicate no match, a concrete projection result,
 * or a merge function
 */
function projectAny(data, model) {
  const matcher = getModelMatcher(model);
  const result = matcher(data);
  return result;
}

/**
 * A namespace to act as a collection of matcher functions. A matcher function
 * {(data: any, model: any) => any} takes a data fragment from the input JSON and
 * a model to match and returns on of the following to indicate the projected
 * content:
 * - undefined, indicating that there was no match
 * - a JSON compatible item (string, number, boolean, null, array, object) to
 *   act as the resulting fragment
 * - a bound merge function, {(MergeArguments) => undefined}, which modifies
 *   the parent result object or array in some way other than setting the
 *   property or pushing the value.
 * @type {Object.<string,matchFunction>}
 */
export const match = {
  string: function (data) {
    return typeof (data) === "string" ? data : undefined;
  },

  number: function (data) {
    return typeof (data) === "number" ? data : undefined;
  },

  boolean: function (data) {
    return typeof (data) === "boolean" ? data : undefined;
  },

  null: function (data) {
    return data === null ? null : undefined;
  },

  fail: function (ignored) {
    return undefined;
  },

  any: function (data) {
    return data;
  }

}

/**
 * A collection of functions to transform a projection result (or input,
 * if you'd like so) in some way.
 */
export const valueTransforms = {
  /**
   * Pass the value unmodified if it is an array with at least one element
   * or an object with at least one property. Return undefined in all other cases.
   * @param {any[] | Object.<string,any>} value 
   * @returns {any[] | Object.<string,any> | undefined}
   */
  notEmpty: function (value) {
    switch (typeofEx(value)) {
      case "array":
        return value.length > 0 ? value : undefined
      case "object":
        return Object.keys(value).length > 0 ? value : undefined
      default:
        return undefined
    }
  },

  /**
   * If the value is an array, then if it contains one value, return that value, or return
   * undefined if it contains not precisely one value.
   * Similarly if value is an object, then if it has one property return that property's
   * value, or undefined otherwise.
   * If the value is a primitive value return it.
   * Otherwise return undefined
   * @param {any[] | Object.<string,any>} value 
   * @returns 
   */
  oneValue: function (value) {
    switch (typeofEx(value)) {
      case "array":
        return value.length == 1 ? value[0] : undefined
      case "object":
        const keys = Object.keys(value)
        return keys.length == 1 ? value[keys[0]] : undefined
      case "string":
      case "number":
      case "boolean":
      case "null":
        return value;
      default:
        return undefined
    }
  },

}

/**
 * A namespace that provides several matcher factory functions:
 * functions that return a matcher function as their output.
 * Usually the matcher functions returned by these matcher factories
 * have their model bound inside, so they ignore the model they
 * get as an argument.
 */
export const makeMatch = {
  /**
   * Returns a matcher function that matches the model object
   * @param {Object.<string,any>} model 
   * @returns {matchFunction}
   */
  object: function (model) {
    return (data) => projectObject(data, model)
  },

  /**
   * Returns a matcher function that matches the model array
   * @param {any[]} model
   * @returns {matchFunction} 
   */
  array: function (model) {
    return (data) => projectArray(data, model)
  },

  /**
   * Returns a matcher function that applies the default
   * matcher for the model to the data, but subsequently
   * applies valueTransforms.notEmpty() to the result,
   * rejecting empty arrays, empty objects, and anything
   * that was not an array or object
   * @param {any[] | Object.<string,any>} model 
   * @returns {matchFunction}
   */
  notEmpty: function (model) {
    return (data) => {
      const value = projectAny(data, model)
      return valueTransforms.notEmpty(value)
    }
  },

  /**
   * Runs the standard array matcher with the modification that
   * any matching child projection results are transformed by
   * the given transform function (and rejected if that
   * transform returns undefined)
   * @param {any[]} arrayModel 
   * @param {(value:any) => any} transform 
   * @returns {matchFunction}
   */
  arrayTransformed: function (arrayModel, transform) {
    return (data) => {
      return projectArray(data, arrayModel, transform)
    }
  },

  /**
   * Returns a matcher that tries to match each of the provided
   * models to the data value, returning the first succesful match.
   * An optional transform can be used to transform the result of
   * each attempted projection, for instance to reject that result
   * upon closer inspection.
   * @param {any[]} arrayOfModels 
   * @param {(value:any) => any} [transform]
   * @returns {matchFunction}
   */
  firstMatch: function (arrayOfModels, transform) {
    return (data) => {
      const result = projectArray([data], arrayOfModels, transform)
      if (result && result.length > 0) {
        return result[0]
      }
      return undefined
    }
  },

  /**
   * Returns a matcher that projects the data object to each of the given model
   * objects, returning the value of the first model match result that has precisely
   * one property. Or in other words: this is a shortcut to use makeMatch.firstMatch
   * with the valueTransforms.oneValue transform
   * @param {Object.<string,any>[]|any} modelsArray 
   * @returns {matchFunction}
   */
  firstOneValue: function (modelsArray) {
    return makeMatch.firstMatch(modelsArray, valueTransforms.oneValue)
  },

  /**
   * Similar to the default array matcher, but rejecting
   * children that project to an empty object or array,
   * or do not project to an object or array at all
   * @param {any[]} arrayModel The array model to match
   * @returns {matchFunction}
   */
  firstNotEmpty: function (arrayModel) {
    return makeMatch.arrayTransformed(arrayModel, valueTransforms.notEmpty)
  },

  /**
   * Return a matcher that first applies matches the data to the model,
   * then passes the result through the transform function (even if the result
   * was 'undefined' to indicate a non-match!)
   * @param {any} model The model to match
   * @param {(value:any) => any} transform The transform to apply to the match result
   * @returns {matchFunction}
   */
  transform: function (model, transform) {
    return (data) => {
      const result = projectAny(data, model)
      return transform ? transform(result) : result
    }
  },

  /**
   * Returns a matcher function that flattens the intermediate object created
   * by matching the intermediate model into the host object
   * @param {Object.<string,any>} model The model for the intermediate object
   * @returns {matchFunction} A matcher function that in turn either returns a
   * merge function bound to the model or undefined (to indicate a non-match).
   */
  flatten: function (model) {
    return (value) => {
      const value2 = projectObject(value, model)
      if (value2 === undefined) {
        return undefined
      } else {
        return bindMergeFunction(unboundMerge.flatten, value2)
      }
    }
  },

}

/**
 * A namespace object holding a selection of unbound merge functions
 * {(args:MergeArguments,value:any) => undefined}. 
 * Use bindMergFunction() to bind these into bound merge functions.
 * An unbound merge function takes a MergeArguments target descriptor
 * and a value to insert that value into the target array or object
 * in some way other than usual.
 * @type {Object.<string,unboundMergeFunction>}
 */
export const unboundMerge = {
  /**
   * The unbound merge function backing the "makeMatch.flatten" functionality
   * @param {MergeArguments} args 
   * @param {any} value 
   */
  flatten: function (args, value) {
    if (value === undefined) {
      throw new Error(`Not expecting value 'undefined' here. Did you try to call this without binding?`)
    }
    const { hostObject, hostKey } = args
    if (!hostObject || !hostKey) {
      throw new Error(`Expecting a host object to merge data into and a key ("flatten" can only be used in objects, not arrays)`)
    }
    for (const [k, v] of Object.entries(value)) {
      hostObject[`${hostKey}-${k}`] = v
    }
  },

}

// ------------------------------------------------------------------------

/**
 * @typedef {Object} Transformation
 * @property {string} modelName
 * @property {string} inputFile
 * @property {string} outputFile
 */

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
 * Project a data object to the named model selected from the given model library.
 * @param {any} data The data to project
 * @param {Object.<string,any> | any} modelOrLibray A map from model names to models, or the
 * model itself if modelName is undefined.
 * @param {string | undefined} modelName The name of the model (if undefined, modelOrLibrary
 * is interpreted as the model itself)
 * @returns {any} The projected data
 */
export function projectToModel(data, modelOrLibrary, modelName) {
  const model = (modelName === undefined || modelName === null) ? modelOrLibrary : modelOrLibrary[modelName]
  if (model === undefined) {
    const modelNames = Object.keys(modelOrLibrary).join(", ")
    throw new Error(`Unknown model "${modelName}". Known model names are: ${modelNames}`)
  }
  return projectAny(data, model);
}

/**
 * Run the application.
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
