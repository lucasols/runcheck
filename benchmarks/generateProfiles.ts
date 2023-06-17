import { z as zod } from 'zod'
import {
  rc_array,
  rc_boolean,
  rc_literals,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_union,
} from '../src/runcheck.js'
import { generateProfile } from './profileUtils'

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

const largeArray = Array.from({ length: 100 }, (_, i) => ({
  string: `string${i}`,
  number: i,
  array: [1, 2, 3],
  obj: JSON.parse(JSON.stringify(validateData)),
  union: i % 2 === 0 ? 'foo' : { type: 'qux', baz: 'qux', num: i },
}))

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

const schema = rc_array(
  rc_object({
    string: rc_string,
    number: rc_number,
    array: rc_array(rc_number),
    obj: objShape,
    union: rc_union(
      rc_string,
      rc_object({ type: rc_literals('bar'), baz: rc_string, num: rc_number }),
      rc_object({ type: rc_literals('baz'), baz: rc_string, num: rc_number }),
      rc_object({
        type: rc_literals('bazs'),
        baz: rc_string,
        num: rc_number,
      }),
      rc_object({ type: rc_literals('qux'), baz: rc_string, num: rc_number }),
    ),
  }),
)

if (rc_parse(largeArray, schema).error) {
  throw new Error('invalid data')
}

generateProfile(
  'runcheck',
  () => {
    rc_parse(largeArray, schema)
  },
  { heatup: 1000 },
)

generateProfile(
  'zod',
  () => {
    dataType2.parse(largeArray)
  },
  { heatup: 1000 },
)
