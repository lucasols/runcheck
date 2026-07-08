import { bench, group, run } from 'mitata'
import {
  rc_array,
  rc_boolean,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
} from '../dist/runcheck.js'

const userSchema = rc_object({
  id: rc_number,
  name: rc_string,
  active: rc_boolean,
  roles: rc_array(rc_string),
  profile: rc_object({
    age: rc_number,
    email: rc_string,
  }),
})

const user = {
  id: 1,
  name: 'Ada',
  active: true,
  roles: ['admin', 'maintainer'],
  profile: {
    age: 37,
    email: 'ada@example.com',
  },
}

group('parse primitives', () => {
  bench('number', () => rc_parse(1, rc_number))
  bench('string', () => rc_parse('runcheck', rc_string))
  bench('boolean', () => rc_parse(true, rc_boolean))
})

group('parse object', () => {
  bench('nested object', () => rc_parse(user, userSchema))
})

group('schema creation', () => {
  bench('object schema', () =>
    rc_object({
      id: rc_number,
      name: rc_string,
      active: rc_boolean,
      roles: rc_array(rc_string),
      profile: rc_object({
        age: rc_number,
        email: rc_string,
      }),
    }),
  )
})

await run()
