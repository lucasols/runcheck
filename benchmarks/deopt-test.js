// @ts-check
'use strict'

import {
  rc_array,
  rc_boolean,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
} from '../dist-test/runcheck.js'

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
  obj: validateData,
}))

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
  }),
)

for (let i = 0; i < 1000; i++) {
  rc_parse(largeArray, schema)
}
