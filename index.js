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
  // equipped_items: [{
  //   item: trx.object({ id: 0 }),
  //   slot: { name: "" },
  //   name: "",
  // }]
  equipped_items: trx.array([{
    item: trx.object({ id: 0 }),
    slot: { name: "" },
    name: "",
  }]),
}
modelLibrary.default = modelLibrary.equipment

runTransformApplication(modelLibrary, [...process.argv])
