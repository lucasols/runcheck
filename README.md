# Runcheck

A lib for js/typescript runtime type checks with autofix support. Runcheck has the goal of being very lightweight. Because of that, it has only around [1.7kb Gzipped](https://bundlephobia.com/package/runcheck), has no dependencies and is tree-shakeable!

Obs: Runcheck is in Beta and it's api can still change

# Installation

```bash
pnpm add runcheck
```

# Basic types:

| runcheck type                   | ts type equivalent                                |
| ------------------------------- | ------------------------------------------------- |
| `rc_string`                     | `string`                                          |
| `rc_number`                     | `number`                                          |
| `rc_boolean`                    | `boolean`                                         |
| `rc_any`                        | `any`                                             |
| `rc_null`                       | `null`                                            |
| `rc_undefined`                  | `undefined`                                       |
| `rc_date`                       | `Date`                                            |
| `rc_intanceof(instance: T)`     | Classes typecheck in general                      |
| `rc_literals(...literals: T[])` | Type literal in general like `hello`, `true`, `1` |
| `rc_union(...types: T[])`       | Union types in general like `string \| 1`         |
| `rc_array<T>(type: T)`          | `T[]`                                             |
| `rc_tuple<T>(...types: T[])`    | `[T, T]`                                          |

# Object types:

## `rc_object`

```ts
const shape = rc_object({
  name: rc_string,
  age: rc_number,
  isCool: rc_boolean,
})
```

The `rc_object` will allow extra properties but, any extra propertie will be striped in parsing. To allow extra in parsing properties, use `rc_extends_obj`.

## `rc_strict_obj`

The same as `rc_object` but, any extra propertie will be throw an error in parsing.

## `rc_obj_intersection`

Allow to merge two `rc_object` types. Example:

```ts
const shape = rc_obj_intersection(
  rc_object({
    name: rc_string,
    age: rc_number,
    isCool: rc_boolean,
  }),
  rc_object({
    address: rc_string,
    phone: rc_string,
  }),
)
```

## `rc_record`

Validates only the values of a object, equivalent to `Record<string, T>` in typescript.

```ts
const shape = rc_record(rc_number)

// shape type is `Record<string, number>`
```

# Parsing

```ts
import { rc_parse } from 'runcheck'

const input = JSON.parse(jsonInput)

const parseResult = rc_parse(input, rc_array(rc_string))

if (parseResult.error) {
  throw new Error(parseResult.errors.join('\n'))
  // Errors are a array of strings
}

const result = parseResult.data
// Do something with result
```

You can also use `rc_parser` to create a reusable parser.

```ts
import { rc_parser } from 'runcheck'

const parser = rc_parser(rc_array(rc_string))

const parseResult = parser(jsonInput)
const parseResult2 = parser(jsonInput2)
```

# Type assertion

Use `rc_is_valid` and `rc_validator` to do a simple type assertion.

```ts
import { rc_is_valid } from 'runcheck'

const input = JSON.parse(jsonInput)

if (rc_is_valid(input, rc_array(rc_string))) {
  // input will be inferred by ts as `string[]`
}
```

# Loose parsing

Use `rc_parse_loose` to parse a input and returning null if the input is invalid.

```ts
import { rc_loose_parse } from 'runcheck'

const input = JSON.parse(jsonInput)

const result = rc_loose_parse(input, rc_array(rc_string)).data

result // string[] | null
```

# Autofixing and fallback values in parsing

Values can be autofixed and fallback values can be provided for parsing. The checks will pass but the result will return warnings messages.

```ts
type SuccessResult = {
  error: false
  data: T
  warnings: string[] | false
}
```

## Fallback

Use the method `rc_[type].withFallback(fallback)` to provide a fallback value if the input is not valid.

```ts
const input = 'hello'

const result = rc_parse(input, rc_string.withFallback('world'))
```

## AutoFix

You can also use `rc_[type].autoFix()` to automatically fix the input if it is not valid.

```ts
const input = 1

const result = rc_parse(
  input,
  rc_string.autoFix((input) => input.toString()),
)
```

There are also some predefined autofixed types that you can import:

```ts
import { rc_string_autofix, rc_boolean_autofix } from 'runcheck/autofixable'

// use like any other type
```

# Performing custom checks

You can also use `rc_[type].where(customCheckFunction)` to perform custom checks.

```ts
const input = 1

const positiveNumberType = rc_number.where((input) => input > 0)
```

# Type modifiers

You can use also modiers like `rc_string.optional()` to extend or modify the rc types:

| runcheck modifier      | ts type equivalent       |
| ---------------------- | ------------------------ |
| `rc_[type].optional()` | `T \| undefined`         |
| `rc_[type].nullable()` | `T \| null`              |
| `rc_[type].nullish()`  | `T \| null \| undefined` |
