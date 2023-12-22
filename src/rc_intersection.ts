import { RcType, createType, parse } from './runcheck'

export function rc_intersection<A, B>(a: RcType<A>, b: RcType<B>): RcType<A & B>
export function rc_intersection<A, B, C>(
  a: RcType<A>,
  b: RcType<B>,
  c: RcType<C>,
): RcType<A & B & C>
export function rc_intersection<A, B, C, D>(
  a: RcType<A>,
  b: RcType<B>,
  c: RcType<C>,
  d: RcType<D>,
): RcType<A & B & C & D>
export function rc_intersection(...types: RcType<any>[]): RcType<any> {
  let kind = ''
  let allIsObject = true

  for (const type of types) {
    if (kind) {
      kind += ' & '
    }

    if (!type._is_object_) {
      allIsObject = false
    }

    kind += type._kind_.includes('|') ? `(${type._kind_})` : type._kind_
  }

  return createType({
    _kind_: kind,
    _is_object_: allIsObject,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        let objResultData: Record<string, unknown> | null = null

        for (const type of types) {
          const result = type._parse_(input, ctx)

          if (!result.ok) {
            if (type._is_object_) {
              return result
            }

            return false
          } else {
            if (type._is_object_) {
              objResultData = { ...(objResultData || {}), ...result.data }
            }
          }
        }

        if (objResultData) {
          return {
            data: objResultData as any,
            errors: false,
          }
        }

        return true
      })
    },
  })
}
