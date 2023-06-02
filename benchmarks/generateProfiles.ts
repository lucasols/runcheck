import {
  rc_number,
  rc_object,
  rc_parse,
  rc_array,
  rc_string,
  rc_boolean,
} from '../src/runcheck.js'
import { generateProfile } from './profileUtils'
import * as old from '../dist/runcheck.js'

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

if (rc_parse(largeArray, schema).error) {
  throw new Error('invalid data')
}

generateProfile(
  'large arrays',
  () => {
    rc_parse(largeArray, schema)
  },
  { heatup: 1000 },
)

export const oldObjShape = old.rc_object({
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

const oldSchema = old.rc_array(
  old.rc_object({
    string: old.rc_string,
    number: old.rc_number,
    array: old.rc_array(old.rc_number),
    obj: oldObjShape,
  }),
)

if (old.rc_parse(largeArray, oldSchema).error) {
  throw new Error('invalid data')
}

generateProfile(
  'large arrays old',
  () => {
    old.rc_parse(largeArray, oldSchema)
  },
  { heatup: 1000 },
)
