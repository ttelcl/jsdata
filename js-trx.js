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
        result[key] = projectedValue
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
      result.push(projected)
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

  object: function (value, model) {
    if (typeof (value) === "object" && !Array.isArray(value)) {
      return projectObject(value, model);
    }
    return undefined;
  },

  array: function (value, model) {
    if (typeof (value) === "object" && Array.isArray(value)) {
      return projectArray(value, model, false)
    }
    return undefined;
  },

  fail: function (value, model) {
    return undefined;
  },

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
