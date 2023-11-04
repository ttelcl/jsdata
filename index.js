import {
  trx,
  runTransformApplication,
} from "./jstrx/js-trx.js";

const modelLibrary = {
  default: {
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
    }]
  }
}

runTransformApplication(modelLibrary, [...process.argv])
