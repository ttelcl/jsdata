import {
  trx,
  runTransformApplication,
} from "./js-trx.js";

const modelLibrary = {}
modelLibrary.equipment = {
  character: {
    name: "",
    id: 0,
    realm: {
      name: "",
      id: trx.number,
      slug: trx.string
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
    realm: trx.flatten({
      name: "",
      id: trx.number,
      slug: trx.string
    }),
  },
  equipped_items: [{
    item: trx.flatten({ id: 0 }),
    slot: trx.flatten({ name: "" }),
    name: "",
  }],
}

runTransformApplication(modelLibrary, [...process.argv])
