import {
  parseArguments,
  loadJson,
  trx,
  projectToModel
} from "./jstrx/js-trx.js";

const args = [...process.argv]

const filePairs = parseArguments(args)

const model = {
  character: {
    name: "",
    id: 0,
    realm: {
      name: "",
      id: trx.number,
      slug: trx.string
    },
  },
}

for (const { inputFile, outputFile } of filePairs) {
  console.log(` "${inputFile}" -> "${outputFile}"`)
  const data = loadJson(inputFile)
  const projected = projectToModel(data, model)
  console.log(JSON.stringify(projected, null, 2))
}
