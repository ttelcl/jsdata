import { parseArguments } from "./jstrx/js-trx.js";

console.log("hello world!");

const args = [...process.argv]
//args.splice(0,2)

const filePairs = parseArguments(args)
for (const {inputFile, outputFile} of filePairs) {
  console.log(` "${inputFile}" -> "${outputFile}"`)
}


