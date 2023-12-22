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
import * as ref from '../src-ref/runcheck.js'
import { group, baseline, bench, run } from './bench.utils.js'

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

group('boolean', { it: 100_000, stat: 'total' }, (i) => {
  const valueToTest = i % 2 === 0

  baseline('current', () => {
    rc_unwrap(rc_parse(valueToTest, rc_boolean))
  })

  bench('ref', () => {
    ref.rc_unwrap(ref.rc_parse(valueToTest, ref.rc_boolean))
  })
})

group('string', (i) => {
  baseline('current', () => {
    rc_unwrap(rc_parse(i.toString(), rc_string))
  })

  bench('ref', () => {
    ref.rc_unwrap(ref.rc_parse(i.toString(), ref.rc_string))
  })
})

group('rc_any vs', { it: 100_000, stat: 'total' }, (i) => {
  const valueToCheck = () => ({
    string: i.toString(),
    [`k${i}`]: i,
  })

  baseline('current', () => {
    rc_unwrap(rc_parse(valueToCheck(), rc_any))
  })

  bench('ref', () => {
    ref.rc_unwrap(ref.rc_parse(valueToCheck(), ref.rc_any))
  })
})

group('number', { it: 100_000, stat: 'total' }, (i) => {
  baseline('current', () => {
    rc_unwrap(rc_parse(i, rc_number))
  })

  bench('ref', () => {
    ref.rc_unwrap(ref.rc_parse(i, ref.rc_number))
  })
})

const refObjShape = ref.rc_object({
  number: ref.rc_number,
  negNumber: ref.rc_number,
  maxNumber: ref.rc_number,
  string: ref.rc_string,
  longString: ref.rc_string,
  boolean: ref.rc_boolean,
  deeplyNested: ref.rc_object({
    foo: ref.rc_string,
    num: ref.rc_number,
    bool: ref.rc_boolean,
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

group('object', () => {
  baseline('current', () => {
    rc_unwrap(rc_parse(validateData, objShape))
  })

  bench('ref', () => {
    ref.rc_unwrap(ref.rc_parse(validateData, refObjShape))
  })
})

group('string in obj', (i) => {
  function getValueToCheck() {
    return { string: i.toString() }
  }

  const rcSchema = rc_object({ string: rc_string })

  const rcDistSchema = ref.rc_object({ string: ref.rc_string })

  baseline('current', () => {
    rc_unwrap(rc_parse(getValueToCheck(), rcSchema))
  })

  bench('ref', () => {
    ref.rc_unwrap(ref.rc_parse(getValueToCheck(), rcDistSchema))
  })
})

group('string in obj, no v8 optimization', (i) => {
  function getValueToCheck() {
    return { string: i.toString(), [`k${i}`]: 1 }
  }

  const schema = rc_object({ string: rc_string })

  baseline('current', () => {
    rc_unwrap(rc_parse(getValueToCheck(), schema))
  })

  const refSchema = ref.rc_object({ string: ref.rc_string })

  bench('ref', () => {
    ref.rc_unwrap(ref.rc_parse(getValueToCheck(), refSchema))
  })
})

group('large array', { it: 500 }, () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => ({
    string: `string${i}`,
    number: i,
    array: [1, 2, 3],
    obj: validateData,
  }))

  const schema = rc_array(
    rc_object({
      string: rc_string,
      number: rc_number,
      array: rc_array(rc_number),
      obj: objShape,
    }),
  )

  baseline('current', () => {
    rc_unwrap(rc_parse(largeArray, schema))
  })

  const refSchema = ref.rc_array(
    ref.rc_object({
      string: ref.rc_string,
      number: ref.rc_number,
      array: ref.rc_array(ref.rc_number),
      obj: refObjShape,
    }),
  )

  bench(`ref`, () => {
    ref.rc_unwrap(ref.rc_parse(largeArray, refSchema))
  })
})

group('large array with union', { it: 500 }, () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => ({
    string: `string${i}`,
    number: i,
    array: [1, 2, 3],
    obj: validateData,
    union: i % 2 === 0 ? 'foo' : { foo: 'bar' },
  }))

  const schema = rc_array(
    rc_object({
      string: rc_string,
      number: rc_number,
      array: rc_array(rc_number),
      obj: objShape,
      union: rc_union(rc_string, rc_object({ foo: rc_string })),
    }),
  )

  baseline('current', () => {
    rc_unwrap(rc_parse(largeArray, schema))
  })

  const refSchema = ref.rc_array(
    ref.rc_object({
      string: ref.rc_string,
      number: ref.rc_number,
      array: ref.rc_array(ref.rc_number),
      obj: refObjShape,
      union: ref.rc_union(ref.rc_string, ref.rc_object({ foo: ref.rc_string })),
    }),
  )

  bench(`ref`, () => {
    ref.rc_unwrap(ref.rc_parse(largeArray, refSchema))
  })
})

group('zod with discriminated union vs rc_union', { it: 500 }, () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => ({
    string: `string${i}`,
    number: i,
    array: [1, 2, 3],
    obj: structuredClone(validateData),
    union: i % 2 === 0 ? 'foo' : { type: 'qux', baz: 'qux', num: i },
  }))

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

  const refSchema = ref.rc_array(
    ref.rc_object({
      string: ref.rc_string,
      number: ref.rc_number,
      array: ref.rc_array(ref.rc_number),
      obj: refObjShape,
      union: ref.rc_union(
        ref.rc_string,
        ref.rc_object({
          type: ref.rc_literals('bar'),
          baz: ref.rc_string,
          num: ref.rc_number,
        }),
        ref.rc_object({
          type: ref.rc_literals('baz'),
          baz: ref.rc_string,
          num: ref.rc_number,
        }),
        ref.rc_object({
          type: ref.rc_literals('bazs'),
          baz: ref.rc_string,
          num: ref.rc_number,
        }),
        ref.rc_object({
          type: ref.rc_literals('qux'),
          baz: ref.rc_string,
          num: ref.rc_number,
        }),
      ),
    }),
  )

  baseline('current', () => {
    rc_unwrap(rc_parse(largeArray, schema))
  })

  bench(`ref`, () => {
    ref.rc_unwrap(ref.rc_parse(largeArray, refSchema))
  })
})

group('discriminated union', { it: 500 }, () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => ({
    string: `string${i}`,
    number: i,
    array: [1, 2, 3],
    obj: structuredClone(validateData),
    union: i % 2 === 0 ? 'foo' : { type: 'qux', baz: 'qux', str: i.toString() },
  }))

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

  baseline('current', () => {
    rc_unwrap(rc_parse(largeArray, schema))
  })

  const refSchema = ref.rc_array(
    ref.rc_object({
      string: ref.rc_string,
      number: ref.rc_number,
      array: ref.rc_array(ref.rc_number),
      obj: refObjShape,
      union: ref.rc_union(
        ref.rc_string,
        ref.rc_discriminated_union('type', {
          bar: { baz: ref.rc_string, num: ref.rc_number },
          baz: { baz: ref.rc_string, num: ref.rc_number },
          bazs: { baz: ref.rc_string, num: ref.rc_number },
          qux: { baz: ref.rc_string, str: ref.rc_string },
        }),
      ),
    }),
  )

  bench(`ref`, () => {
    ref.rc_unwrap(ref.rc_parse(largeArray, refSchema))
  })
})

group('.optional', () => {
  const schema = rc_object({
    string: rc_string.optional,
    number: rc_number.optional,
    array: rc_array(rc_number).optional,
    obj: objShape.optional,
    union: rc_union(rc_string, rc_number).optional,
  })

  const refSchema = ref.rc_object({
    string: ref.rc_string.optional(),
    number: ref.rc_number.optional(),
    array: ref.rc_array(ref.rc_number).optional(),
    obj: refObjShape.optional(),
    union: ref.rc_union(ref.rc_string, ref.rc_number).optional(),
  })

  baseline('current', () => {
    rc_unwrap(rc_parse(validateData, schema))
  })

  bench(`ref`, () => {
    ref.rc_unwrap(ref.rc_parse(validateData, refSchema))
  })
})

run()
