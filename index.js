import {
  match,
  makeMatch,
  runTransformApplication,
} from "./json-reshape.js";

const modelLibrary = {}
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
modelLibrary.default = modelLibrary.equipment
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

runTransformApplication(modelLibrary, [...process.argv])
