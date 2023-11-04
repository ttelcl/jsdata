
/**
 * @typedef {Object} DataFilePair
 * @property {string} inputFile
 * @property {string} outputFile
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

