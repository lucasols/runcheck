import { rc_number, rc_object, rc_parse, rc_array } from '../src/runcheck.js'
import { generateProfile } from './profileUtils'

const largeArray = Array.from({ length: 1000 }, () => ({
  array: [1, 2, 3],
}))

generateProfile(
  'large arrays',
  () => {
    const schema = rc_array(
      rc_object({
        array: rc_array(rc_number),
      }),
    )

    rc_parse(largeArray, schema)
  },
  { heatup: 100 },
)
