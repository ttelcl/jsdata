import {readFileSync} from 'fs';

/**
 * @typedef {Object} DataFilePair
 * @property {string} inputFile
 * @property {string} outputFile
 */

/**
 * Function that tries to match the actual data to the given model,
 * returning the projected data on success, or undefined if not matched
 * @typedef {(data: any, model: any) => any} matchFunction
 */

/**
 * Parse arguments. Currently the only supported arguments are of
 * the shapes "-f input.json output.json" and "-f input.json"
 * @param {string[]} args The arguments to parse
 * @returns {DataFilePair[]}
 */
export function parseArguments(args) {
  const results = []
  while(args.length > 0) {
    const arg = args.shift()
    if (arg === "-f") {
      if (args.length > 0) {
        const inputFile = args.shift()
        const extensionIndex = inputFile.lastIndexOf(".")
        if (extensionIndex < 0) {
          throw new Error(`Expecting file name to have an extension`)
        }
        if (args.length > 0 && !args[0].startsWith("-")) {
          const outputFile = args.shift()
          results.push({inputFile, outputFile});
        } else {
          const extension = inputFile.slice(extensionIndex)
          const prefix = inputFile.slice(0, extensionIndex)
          const outputFile = prefix + ".out" + extension
          results.push({inputFile, outputFile});
        }
      } else {
        throw new Error(`Expecting a file name after "-f"`)
      }
    } else if (arg.endsWith("node.exe")) {
      const script = args.shift()
      // ignore
    } else {
      throw new Error(`Unexpected argument "${args[0]}"; expecting "-f"`)
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

function typeofEx(value) {
  const t0 = typeof(value)
  switch (t0) {
    case "object":
      return value === null ? "null" : Array.isArray(value) ? "array" : "object"
    default:
      return t0
  }
}

function projectObject(data, model) {
  throw new Error("NYI: projectObject")
}

function projectArray(data, model) {
  throw new Error("NYI: projectArray")
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
      return trx.array;
    case "object":
      // The model only matches an object (that is not null nor an array),
      // and the data is projected to the specification of the content in
      // the model object
      return trx.object;
    case "undefined":
      // Returns a matcher that always fails
      return trx.fail;
    case "null":
      throw new Error("Model objects do not support 'null' directly")
    default:
      throw new Error(`Unexpected model type "${modelType}"`)
  }
}

function projectAny(data, model) {
  const matcher = getModelMatcher(model);
  return matcher(data, model);
}

export function projectToModel(data, model) {
  return projectAny(data, model);
}

export const trx = {
  string: function (value, model) {
    if (typeof(value) === "string") {
      return value;
    }
    return undefined;
  },

  number: function (value, model) {
    if (typeof(value) === "number") {
      return value;
    }
    return undefined;
  },

  boolean: function (value, model) {
    if (typeof(value) === "boolean") {
      return value;
    }
    return undefined;
  },

  object: function (value, model) {
    if (typeof(value) === "object" && !Array.isArray(value)) {
      return projectObject(value, model);
    }
    return undefined;
  },
  
  array: function (value, model) {
    if (typeof(value) === "object" && Array.isArray(value)) {
      return projectArray(value, model)
    }
    return undefined;
  },

  fail: function (value, model) {
    return undefined;
  },

}


