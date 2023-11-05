import {
  match,
  makeMatch,
  valueTransforms,
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
  location: { details: [""] }
}
modelLibrary.sampleLocation2 = {
  character: makeMatch.flatten({ name: "" }),
  location: { details: [0] }
}
modelLibrary.sampleLocation3 = {
  character: makeMatch.flatten({ name: "" }),
  location: { details: ["", 0] }
}

modelLibrary.sampleWords1 = {
  "words": [
    { "en": "" }
  ]
}
modelLibrary.sampleWords2 = {
  "words": [
    makeMatch.notEmpty({ "en": "" }),
  ]
}
modelLibrary.sampleWords4a = {
  "words": [
    // This does probably not what you intended: the first item matches
    // as "{}" instead of not matching the 4th word
    { "en": "" },
    { "nl": "" },
  ]
}
modelLibrary.sampleWords4b = {
  "words": [
    // This is one fix: drop empty objects
    makeMatch.notEmpty({ "en": "" }),
    makeMatch.notEmpty({ "nl": "" }),
  ]
}
modelLibrary.sampleWords4c = {
  // This is another fix: modify array matching semantics
  "words": makeMatch.firstNotEmpty([
    { "en": "" },
    { "nl": "" },
  ])
}
modelLibrary.sampleWords4d = {
  // Equivalent to sampleWords4c
  "words": makeMatch.arrayTransformed([
    { "en": "" },
    { "nl": "" },
  ], valueTransforms.notEmpty)
}

modelLibrary.sampleName1 = {
  name: makeMatch.firstMatch([
    { "nl": "" },
    { "en": "" },
  ], valueTransforms.notEmpty),
}

modelLibrary.sampleName2a = {
  name: makeMatch.firstMatch([
    { "nl": "" },
    { "en": "" },
  ], valueTransforms.oneValue),
}

modelLibrary.sampleName2b = {
  // same as sampleName2a, using the shorthand firstOneValue
  name: makeMatch.firstOneValue([
    { "nl": "" },
    { "en": "" },
  ]),
}

modelLibrary.default = modelLibrary.sampleCharacter1

runTransformApplication(modelLibrary, [...process.argv])
