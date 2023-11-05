import {
  match,
  makeMatch,
  runTransformApplication,
} from "./json-reshape.js";

const modelLibrary = {}

modelLibrary.sampleCharacter1 = {
  id: 0,
  character: {
    name: "", age: 0
  }
}
modelLibrary.sampleCharacter2 = {
  id: 0,
  // flatten the content of the 'character' field
  character: makeMatch.flatten({
    name: "", age: 0
  })
}

modelLibrary.sampleLocation1 = {
  character: makeMatch.flatten({ name: "" }),
  location: { details: [ "" ] }
}
modelLibrary.sampleLocation2 = {
  character: makeMatch.flatten({ name: "" }),
  location: { details: [ 0 ] }
}
modelLibrary.sampleLocation3 = {
  character: makeMatch.flatten({ name: "" }),
  location: { details: [ "", 0 ] }
}

modelLibrary.sampleWords1 = {
  "words": [
    { "en": "" }
  ]
}

modelLibrary.equipment = {
  character: {
    name: "",
    id: 0,
    realm: {
      name: "",
      id: match.number,
      slug: match.string
    },
  },
  equipped_items: [{
    item: { id: 0 },
    slot: { name: "" },
    name: "",
  }],
}
modelLibrary.equipment2 = {
  character: {
    name: "",
    id: 0,
    realm: makeMatch.flatten({
      name: "",
      id: match.number,
      slug: match.string
    }),
  },
  equipped_items: [{
    item: makeMatch.flatten({ id: 0 }),
    slot: makeMatch.flatten({ name: "" }),
    name: "",
  }],
}
modelLibrary.default = modelLibrary.sample1

runTransformApplication(modelLibrary, [...process.argv])
