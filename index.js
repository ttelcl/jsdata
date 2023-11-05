import {
  match,
  makeMatch,
  runTransformApplication,
} from "./json-reshape.js";

const modelLibrary = {}

modelLibrary.character = {
  id: 0,
  character: {
    name: "", age: 0
  }
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

modelLibrary.default = modelLibrary.character

runTransformApplication(modelLibrary, [...process.argv])
