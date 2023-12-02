/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { baseline, bench, group, run } from 'mitata'
import { z as zod } from 'zod'
import * as dist from '../dist/runcheck.js'
import {
  rc_any,
  rc_array,
  rc_boolean,
  rc_discriminated_union,
  rc_literals,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_union,
  rc_unwrap,
} from '../src/runcheck.js'
import { rc_object_fast } from '../src/rc_object.js'

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

const objDataType = zod.object({
  number: zod.number(),
  negNumber: zod.number(),
  maxNumber: zod.number(),
  string: zod.string(),
  longString: zod.string(),
  boolean: zod.boolean(),
  deeplyNested: zod.object({
    foo: zod.string(),
    num: zod.number(),
    bool: zod.boolean(),
  }),
})

const oldVersionToLoad = '0.38.1'

const old = (await import(
  `../dist-old/dist.${oldVersionToLoad}/runcheck.js`
)) as typeof import('../dist/runcheck.js')

const oldObjShape = old.rc_object({
  number: old.rc_number,
  negNumber: old.rc_number,
  maxNumber: old.rc_number,
  string: old.rc_string,
  longString: old.rc_string,
  boolean: old.rc_boolean,
  deeplyNested: old.rc_object({
    foo: old.rc_string,
    num: old.rc_number,
    bool: old.rc_boolean,
  }),
})

const distObjShape = dist.rc_object({
  number: dist.rc_number,
  negNumber: dist.rc_number,
  maxNumber: dist.rc_number,
  string: dist.rc_string,
  longString: dist.rc_string,
  boolean: dist.rc_boolean,
  deeplyNested: dist.rc_object({
    foo: dist.rc_string,
    num: dist.rc_number,
    bool: dist.rc_boolean,
  }),
})

const objShape = rc_object({
  number: rc_number,
  negNumber: rc_number,
  maxNumber: rc_number,
  string: rc_string,
  longString: rc_string,
  boolean: rc_boolean,
  deeplyNested: rc_object({
    foo: rc_string,
    num: rc_number,
    bool: rc_boolean,
  }),
})

function throwIfError(
  result: { error: true; errors: string[] } | { error: false },
) {
  if (result.error) {
    throw new Error(result.errors.join('\n'))
  }
}

const groups = new Map<string, () => void>()
const onlyGroups = new Map<string, () => void>()

function addGroup(name: string, fn: () => void, only = false) {
  if (only) {
    onlyGroups.set(name, fn)
  } else {
    groups.set(name, fn)
  }
}

addGroup.only = (name: string, fn: () => void) => {
  addGroup(name, fn, true)
}

addGroup('object', () => {
  baseline('runcheck', () => {
    throwIfError(rc_parse(validateData, objShape))
  })

  bench('zod', () => {
    objDataType.parse(validateData)
  })
})

addGroup('string', () => {
  const dataType = zod.string()

  bench('zod', () => {
    dataType.parse(validateData.string)
  })

  baseline('runcheck', () => {
    throwIfError(rc_parse(validateData.string, rc_string))
  })
})

addGroup.only('string in obj', () => {
  const valueToCheck = { string: validateData.string }

  const rcSchema = rc_object({ string: rc_string })

  baseline('runcheck', () => {
    rc_unwrap(rc_parse(valueToCheck, rcSchema))
  })

  const rcDistSchema = dist.rc_object({ string: dist.rc_string })

  bench('runcheck dist', () => {
    dist.rc_unwrap(dist.rc_parse(valueToCheck, rcDistSchema))
  })

  const rcObjFast = rc_object_fast({ string: rc_string })

  bench('runcheck rc_object_fast', () => {
    rc_unwrap(rc_parse(valueToCheck, rcObjFast))
  })

  bench('rc_any', () => {
    rc_unwrap(rc_parse(valueToCheck, rc_any))
  })

  bench('vanilla js', () => {
    const value = valueToCheck as unknown

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('invalid obj')
    }

    if (!('string' in value)) {
      throw new Error('missing string')
    }

    if (typeof value.string !== 'string') {
      throw new Error('invalid string')
    }

    value
    // ^?
  })

  const zodSchema = zod.object({ string: zod.string() })

  bench('zod', () => {
    zodSchema.parse(valueToCheck)
  })
})

addGroup('number', () => {
  const dataType = zod.number()

  bench('zod', () => {
    dataType.parse(validateData.number)
  })

  baseline('runcheck', () => {
    throwIfError(rc_parse(validateData.number, rc_number))
  })
})

addGroup('boolean', () => {
  const dataType = zod.boolean()

  bench('zod', () => {
    dataType.parse(validateData.boolean)
  })

  baseline('runcheck', () => {
    throwIfError(rc_parse(validateData.boolean, rc_boolean))
  })
})

addGroup('large array', () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => ({
    string: `string${i}`,
    number: i,
    array: [1, 2, 3],
    obj: validateData,
  }))

  const dataType = zod.array(
    zod.object({
      string: zod.string(),
      number: zod.number(),
      array: zod.array(zod.number()),
      obj: objDataType,
    }),
  )

  bench('zod', () => {
    dataType.parse(largeArray)
  })

  const schema = rc_array(
    rc_object({
      string: rc_string,
      number: rc_number,
      array: rc_array(rc_number),
      obj: objShape,
    }),
  )

  baseline('runcheck', () => {
    throwIfError(rc_parse(largeArray, schema))
  })

  const oldSchema = old.rc_array(
    old.rc_object({
      string: old.rc_string,
      number: old.rc_number,
      array: old.rc_array(old.rc_number),
      obj: oldObjShape,
    }),
  )

  bench(`runcheck (${oldVersionToLoad})`, () => {
    throwIfError(old.rc_parse(largeArray, oldSchema))
  })

  const distSchema = dist.rc_array(
    dist.rc_object({
      string: dist.rc_string,
      number: dist.rc_number,
      array: dist.rc_array(dist.rc_number),
      obj: distObjShape,
    }),
  )

  bench(`runcheck (dist)`, () => {
    throwIfError(dist.rc_parse(largeArray, distSchema))
  })
})

addGroup('large array with union', () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => ({
    string: `string${i}`,
    number: i,
    array: [1, 2, 3],
    obj: validateData,
    union: i % 2 === 0 ? 'foo' : { foo: 'bar' },
  }))

  const dataType = zod.array(
    zod.object({
      string: zod.string(),
      number: zod.number(),
      array: zod.array(zod.number()),
      obj: objDataType,
      union: zod.union([zod.string(), zod.object({ foo: zod.string() })]),
    }),
  )

  bench('zod', () => {
    dataType.parse(largeArray)
  })

  const schema = rc_array(
    rc_object({
      string: rc_string,
      number: rc_number,
      array: rc_array(rc_number),
      obj: objShape,
      union: rc_union(rc_string, rc_object({ foo: rc_string })),
    }),
  )

  baseline('runcheck', () => {
    throwIfError(rc_parse(largeArray, schema))
  })

  const oldSchema = old.rc_array(
    old.rc_object({
      string: old.rc_string,
      number: old.rc_number,
      array: old.rc_array(old.rc_number),
      obj: oldObjShape,
      union: old.rc_union(old.rc_string, old.rc_object({ foo: old.rc_string })),
    }),
  )

  const distSchema = dist.rc_array(
    dist.rc_object({
      string: dist.rc_string,
      number: dist.rc_number,
      array: dist.rc_array(dist.rc_number),
      obj: distObjShape,
      union: dist.rc_union(
        dist.rc_string,
        dist.rc_object({ foo: dist.rc_string }),
      ),
    }),
  )

  bench(`runcheck (${oldVersionToLoad})`, () => {
    throwIfError(old.rc_parse(largeArray, oldSchema))
  })

  bench(`runcheck (dist)`, () => {
    throwIfError(dist.rc_parse(largeArray, distSchema))
  })
})

addGroup('zod with discriminated union vs rc_union', () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => ({
    string: `string${i}`,
    number: i,
    array: [1, 2, 3],
    obj: JSON.parse(JSON.stringify(validateData)),
    union: i % 2 === 0 ? 'foo' : { type: 'qux', baz: 'qux', num: i },
  }))

  const dataType2 = zod.array(
    zod.object({
      string: zod.string(),
      number: zod.number(),
      array: zod.array(zod.number()),
      obj: objDataType,
      union: zod.union([
        zod.string(),
        zod.discriminatedUnion('type', [
          zod.object({
            type: zod.literal('bar'),
            baz: zod.string(),
            num: zod.number(),
          }),
          zod.object({
            type: zod.literal('baz'),
            baz: zod.string(),
            num: zod.number(),
          }),
          zod.object({
            type: zod.literal('bazs'),
            baz: zod.string(),
            num: zod.number(),
          }),
          zod.object({
            type: zod.literal('qux'),
            baz: zod.string(),
            num: zod.number(),
          }),
        ]),
      ]),
    }),
  )

  const schema = rc_array(
    rc_object({
      string: rc_string,
      number: rc_number,
      array: rc_array(rc_number),
      obj: objShape,
      union: rc_union(
        rc_string,
        rc_object({
          type: rc_literals('bar'),
          baz: rc_string,
          num: rc_number,
        }),
        rc_object({
          type: rc_literals('baz'),
          baz: rc_string,
          num: rc_number,
        }),
        rc_object({
          type: rc_literals('bazs'),
          baz: rc_string,
          num: rc_number,
        }),
        rc_object({
          type: rc_literals('qux'),
          baz: rc_string,
          num: rc_number,
        }),
      ),
    }),
  )

  const oldSchema = old.rc_array(
    old.rc_object({
      string: old.rc_string,
      number: old.rc_number,
      array: old.rc_array(old.rc_number),
      obj: oldObjShape,
      union: old.rc_union(
        old.rc_string,
        old.rc_object({
          type: old.rc_literals('bar'),
          baz: old.rc_string,
          num: old.rc_number,
        }),
        old.rc_object({
          type: old.rc_literals('baz'),
          baz: old.rc_string,
          num: old.rc_number,
        }),
        old.rc_object({
          type: old.rc_literals('bazs'),
          baz: old.rc_string,
          num: old.rc_number,
        }),
        old.rc_object({
          type: old.rc_literals('qux'),
          baz: old.rc_string,
          num: old.rc_number,
        }),
      ),
    }),
  )

  const distSchema = dist.rc_array(
    dist.rc_object({
      string: dist.rc_string,
      number: dist.rc_number,
      array: dist.rc_array(dist.rc_number),
      obj: oldObjShape,
      union: dist.rc_union(
        dist.rc_string,
        dist.rc_object({
          type: dist.rc_literals('bar'),
          baz: dist.rc_string,
          num: dist.rc_number,
        }),
        dist.rc_object({
          type: dist.rc_literals('baz'),
          baz: dist.rc_string,
          num: dist.rc_number,
        }),
        dist.rc_object({
          type: dist.rc_literals('bazs'),
          baz: dist.rc_string,
          num: dist.rc_number,
        }),
        dist.rc_object({
          type: dist.rc_literals('qux'),
          baz: dist.rc_string,
          num: dist.rc_number,
        }),
      ),
    }),
  )

  baseline('runcheck', () => {
    throwIfError(rc_parse(largeArray, schema))
  })

  bench('zod', () => {
    dataType2.parse(largeArray)
  })

  bench(`runcheck (${oldVersionToLoad})`, () => {
    throwIfError(old.rc_parse(largeArray, oldSchema))
  })

  bench(`runcheck (dist)`, () => {
    throwIfError(dist.rc_parse(largeArray, distSchema))
  })
})

addGroup('discriminated union', () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => ({
    string: `string${i}`,
    number: i,
    array: [1, 2, 3],
    obj: JSON.parse(JSON.stringify(validateData)),
    union: i % 2 === 0 ? 'foo' : { type: 'qux', baz: 'qux', str: i.toString() },
  }))

  const dataType2 = zod.array(
    zod.object({
      string: zod.string(),
      number: zod.number(),
      array: zod.array(zod.number()),
      obj: objDataType,
      union: zod.union([
        zod.string(),
        zod.discriminatedUnion('type', [
          zod.object({
            type: zod.literal('bar'),
            baz: zod.string(),
            num: zod.number(),
          }),
          zod.object({
            type: zod.literal('baz'),
            baz: zod.string(),
            num: zod.number(),
          }),
          zod.object({
            type: zod.literal('bazs'),
            baz: zod.string(),
            num: zod.number(),
          }),
          zod.object({
            type: zod.literal('qux'),
            baz: zod.string(),
            str: zod.string(),
          }),
        ]),
      ]),
    }),
  )

  const schema = rc_array(
    rc_object({
      string: rc_string,
      number: rc_number,
      array: rc_array(rc_number),
      obj: objShape,
      union: rc_union(
        rc_string,
        rc_discriminated_union('type', {
          bar: { baz: rc_string, num: rc_number },
          baz: { baz: rc_string, num: rc_number },
          bazs: { baz: rc_string, num: rc_number },
          qux: { baz: rc_string, str: rc_string },
        }),
      ),
    }),
  )

  const schemaWithUnion = rc_array(
    rc_object({
      string: rc_string,
      number: rc_number,
      array: rc_array(rc_number),
      obj: objShape,
      union: rc_union(
        rc_string,
        rc_object({
          type: rc_literals('bar'),
          baz: rc_string,
          num: rc_number,
        }),
        rc_object({
          type: rc_literals('baz'),
          baz: rc_string,
          num: rc_number,
        }),
        rc_object({
          type: rc_literals('bazs'),
          baz: rc_string,
          num: rc_number,
        }),
        rc_object({
          type: rc_literals('qux'),
          baz: rc_string,
          str: rc_string,
        }),
      ),
    }),
  )

  baseline('runcheck', () => {
    rc_unwrap(rc_parse(largeArray, schema))
  })

  bench('runcheck with union', () => {
    rc_unwrap(rc_parse(largeArray, schemaWithUnion))
  })

  bench('zod', () => {
    dataType2.parse(largeArray)
  })
})

for (const [name, fn] of onlyGroups.size ? onlyGroups : groups) {
  group(name, fn)
}

await run()
