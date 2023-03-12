'use strict'

import {
  rc_object,
  rc_array,
  rc_parse,
  rc_number,
} from '../dist-test/runcheck.js'

const largeArray = Array.from({ length: 1000 }, () => ({
  array: [1, 2, 3],
}))

const schema = rc_array(
  rc_object({
    array: rc_array(rc_number),
  }),
)

for (let i = 0; i < 1000; i++) {
  rc_parse(largeArray, schema)
}
