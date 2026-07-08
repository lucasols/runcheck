import { readFileSync } from 'node:fs'
import { baseline, bench, group, run } from 'mitata'
import * as current from '../dist/runcheck.js'

let published
let publishedVersion

try {
  publishedVersion = JSON.parse(
    readFileSync(
      new URL('./published/node_modules/runcheck/package.json', import.meta.url),
      'utf8',
    ),
  ).version
  published = await import('./published/node_modules/runcheck/dist/runcheck.js')
} catch {
  console.error(
    'Published runcheck build not found. Run `node benchmarks/setup-published.mjs` first.',
  )
  process.exit(1)
}

const currentLabel = 'current build'
const publishedLabel = `runcheck@${publishedVersion} (published)`

const validateData = Object.freeze({
  number: 1,
  negNumber: -1,
  maxNumber: Number.MAX_VALUE,
  string: 'string',
  longString:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Vivendum intellegat et qui, ei denique consequuntur vix. Semper aeterno percipit ut his, sea ex utinam referrentur repudiandae. No epicuri hendrerit consetetur sit, sit dicta adipiscing ex, in facete detracto deterruisset duo. Quot populo ad qui. Sit fugit nostrum et. Ad per diam dicant interesset, lorem iusto sensibus ut sed. No dicam aperiam vis. Pri posse graeco definitiones cu, id eam populo quaestio adipiscing, usu quod malorum te. Ex nam agam veri, dicunt efficiantur ad qui, ad legere adversarium sit. Commune platonem mel id, brute adipiscing duo an. Vivendum intellegat et qui, ei denique consequuntur vix. Offendit eleifend moderatius ex vix, quem odio mazim et qui, purto expetendis cotidieque quo cu, veri persius vituperata ei nec. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  boolean: true,
  deeplyNested: {
    foo: 'bar',
    num: 1,
    bool: false,
  },
})

function getSchemas(rc) {
  const objSchema = rc.rc_object({
    number: rc.rc_number,
    negNumber: rc.rc_number,
    maxNumber: rc.rc_number,
    string: rc.rc_string,
    longString: rc.rc_string,
    boolean: rc.rc_boolean,
    deeplyNested: rc.rc_object({
      foo: rc.rc_string,
      num: rc.rc_number,
      bool: rc.rc_boolean,
    }),
  })

  return {
    obj: objSchema,
    stringObj: rc.rc_object({ string: rc.rc_string }),
    largeArray: rc.rc_array(
      rc.rc_object({
        string: rc.rc_string,
        number: rc.rc_number,
        array: rc.rc_array(rc.rc_number),
        obj: objSchema,
      }),
    ),
    largeArrayWithUnion: rc.rc_array(
      rc.rc_object({
        string: rc.rc_string,
        number: rc.rc_number,
        array: rc.rc_array(rc.rc_number),
        obj: objSchema,
        union: rc.rc_union(rc.rc_string, rc.rc_object({ foo: rc.rc_string })),
      }),
    ),
    discriminatedUnion: rc.rc_array(
      rc.rc_object({
        string: rc.rc_string,
        number: rc.rc_number,
        array: rc.rc_array(rc.rc_number),
        obj: objSchema,
        union: rc.rc_union(
          rc.rc_string,
          rc.rc_discriminated_union('type', {
            bar: { baz: rc.rc_string, num: rc.rc_number },
            baz: { baz: rc.rc_string, num: rc.rc_number },
            bazs: { baz: rc.rc_string, num: rc.rc_number },
            qux: { baz: rc.rc_string, str: rc.rc_string },
          }),
        ),
      }),
    ),
  }
}

const cur = getSchemas(current)
const pub = getSchemas(published)

const strings = Array.from({ length: 1024 }, (_, i) => `string${i}`)

const deoptObjects = Array.from({ length: 1024 }, (_, i) => ({
  string: `string${i}`,
  [`key${i}`]: i,
}))

const largeArray = Array.from({ length: 100 }, (_, i) => ({
  string: `string${i}`,
  number: i,
  array: [1, 2, 3],
  obj: validateData,
}))

const largeArrayWithUnion = Array.from({ length: 100 }, (_, i) => ({
  string: `string${i}`,
  number: i,
  array: [1, 2, 3],
  obj: validateData,
  union: i % 2 === 0 ? 'foo' : { foo: 'bar' },
}))

const discriminatedUnionArray = Array.from({ length: 100 }, (_, i) => ({
  string: `string${i}`,
  number: i,
  array: [1, 2, 3],
  obj: validateData,
  union: i % 2 === 0 ? 'foo' : { type: 'qux', baz: 'qux', str: `${i}` },
}))

group('parse boolean', () => {
  baseline(currentLabel, () => {
    current.rc_unwrap(current.rc_parse(true, current.rc_boolean))
  })

  bench(publishedLabel, () => {
    published.rc_unwrap(published.rc_parse(true, published.rc_boolean))
  })
})

group('parse number', () => {
  baseline(currentLabel, () => {
    current.rc_unwrap(current.rc_parse(1.5, current.rc_number))
  })

  bench(publishedLabel, () => {
    published.rc_unwrap(published.rc_parse(1.5, published.rc_number))
  })
})

group('parse string', () => {
  let ci = 0
  let pi = 0

  baseline(currentLabel, () => {
    current.rc_unwrap(
      current.rc_parse(strings[ci++ & 1023], current.rc_string),
    )
  })

  bench(publishedLabel, () => {
    published.rc_unwrap(
      published.rc_parse(strings[pi++ & 1023], published.rc_string),
    )
  })
})

group('parse nested object', () => {
  baseline(currentLabel, () => {
    current.rc_unwrap(current.rc_parse(validateData, cur.obj))
  })

  bench(publishedLabel, () => {
    published.rc_unwrap(published.rc_parse(validateData, pub.obj))
  })
})

group('parse object with unknown keys (v8 deopt)', () => {
  let ci = 0
  let pi = 0

  baseline(currentLabel, () => {
    current.rc_unwrap(
      current.rc_parse(deoptObjects[ci++ & 1023], cur.stringObj),
    )
  })

  bench(publishedLabel, () => {
    published.rc_unwrap(
      published.rc_parse(deoptObjects[pi++ & 1023], pub.stringObj),
    )
  })
})

group('parse large array', () => {
  baseline(currentLabel, () => {
    current.rc_unwrap(current.rc_parse(largeArray, cur.largeArray))
  })

  bench(publishedLabel, () => {
    published.rc_unwrap(published.rc_parse(largeArray, pub.largeArray))
  })
})

group('parse large array with union', () => {
  baseline(currentLabel, () => {
    current.rc_unwrap(
      current.rc_parse(largeArrayWithUnion, cur.largeArrayWithUnion),
    )
  })

  bench(publishedLabel, () => {
    published.rc_unwrap(
      published.rc_parse(largeArrayWithUnion, pub.largeArrayWithUnion),
    )
  })
})

group('parse discriminated union', () => {
  baseline(currentLabel, () => {
    current.rc_unwrap(
      current.rc_parse(discriminatedUnionArray, cur.discriminatedUnion),
    )
  })

  bench(publishedLabel, () => {
    published.rc_unwrap(
      published.rc_parse(discriminatedUnionArray, pub.discriminatedUnion),
    )
  })
})

group('schema creation', () => {
  baseline(currentLabel, () => {
    getSchemas(current)
  })

  bench(publishedLabel, () => {
    getSchemas(published)
  })
})

await run()
