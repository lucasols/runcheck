function getPreciseTimeMs() {
  const [seconds, nanoseconds] = process.hrtime()
  return seconds * 1_000 + nanoseconds / 1_000_000
}

let toRun: (() => void)[] = []
let onlyRun: (() => void)[] = []
let skippedRuns = 0

let groupCtx: {
  isWarmup: boolean
  initializationCall: boolean
  timingsList: Record<string, number[]>
  groupBenchs: string[]
  baseline: string | null
  benchs: (() => void)[]
}

export function bench(id: string, fn: () => void) {
  groupCtx.benchs.push(() => {
    if (groupCtx.isWarmup) {
      fn()
      return
    }

    const start = getPreciseTimeMs()
    fn()
    const elapsed = getPreciseTimeMs() - start

    if (groupCtx.initializationCall) {
      groupCtx.groupBenchs.push(id)
      groupCtx.timingsList[id] = []
    } else {
      groupCtx.timingsList[id]!.push(elapsed)
    }
  })
}

export function baseline(id: string, fn: () => void) {
  groupCtx.benchs.push(() => {
    if (groupCtx.isWarmup) {
      fn()
      return
    }

    const start = getPreciseTimeMs()
    fn()
    const elapsed = getPreciseTimeMs() - start

    if (groupCtx.initializationCall) {
      groupCtx.baseline = id
      groupCtx.groupBenchs.push(id)
      groupCtx.timingsList[id] = []
    } else {
      groupCtx.timingsList[id]!.push(elapsed)
    }
  })
}

type GroupConfig = {
  it?: number
  warmup?: number
  noRandomize?: boolean
}

function isFunction(fn: any): fn is () => void {
  return typeof fn === 'function'
}

function groupBase({
  id,
  fn,
  only,
  skip,
  options = {},
}: {
  id: string
  options?: GroupConfig
  fn: (i: number) => void
  only?: boolean
  skip?: boolean
}) {
  const { it = 1_000, warmup = 10_000, noRandomize: noRandomize } = options

  if (skip) {
    skippedRuns++
    return
  }
  const runGroup = only ? onlyRun : toRun

  runGroup.push(() => {
    groupCtx = {
      baseline: null,
      initializationCall: true,
      groupBenchs: [],
      isWarmup: false,
      timingsList: {},
      benchs: [],
    }

    fn(-1)
    groupCtx.benchs.forEach((fn) => fn())

    groupCtx.initializationCall = false

    const variations = groupCtx.groupBenchs

    const baseline = groupCtx.baseline

    groupCtx.isWarmup = true

    for (let i = 0; i < warmup; i++) {
      groupCtx.benchs = []
      fn(i)
      groupCtx.benchs.forEach((fn) => fn())
    }

    groupCtx.isWarmup = false

    groupCtx.timingsList = Object.fromEntries(
      Object.keys(groupCtx.timingsList).map((id) => [id, []]),
    )

    for (let i = 0; i < it; i++) {
      groupCtx.benchs = []
      fn(i)

      if (!noRandomize) {
        groupCtx.benchs = sortBy(groupCtx.benchs, () => Math.random())
      }

      groupCtx.benchs.forEach((fn) => fn())
    }

    const stats = Object.entries(groupCtx.timingsList).map(
      ([id, timings]) => [id, getStats(timings)] as const,
    )

    const refStat: keyof (typeof stats)[0][1] = 'min'

    let sortedTimings = sortBy(
      stats,
      ([id, stats]) => stats[refStat] + (id === baseline ? 0 : 0.000000001),
      {
        order: 'asc',
      },
    )

    console.log(
      `\n${id}${color('gray', ` (iterations: ${it.toLocaleString()}):`)}`,
    )

    const longestVariation = variations.reduce(
      (acc, curr) => Math.max(acc, curr.length),
      0,
    )

    const baselineTime =
      sortedTimings.find(([id]) => id === baseline)![1][refStat] ||
      sortedTimings[0]![1][refStat] ||
      0

    for (const [id, stats] of sortedTimings) {
      const time = stats[refStat]

      const timesSlower = time / baselineTime

      const formattedTimesSlower = Math.abs(
        timesSlower < 1 ? 1 / timesSlower : timesSlower,
      ).toFixed(2)

      const nameAndDots = id.padEnd(longestVariation + 3, '.')

      const name = color('cyan', nameAndDots.slice(0, id.length))
      const dots = color('gray', nameAndDots.slice(id.length))

      console.log(
        joinStrings(
          id === baseline ? bold(color('cyan', '>> ')) : '   ',
          id === baseline ? bold(name) : name,
          dots,
          ' ',
          formatTime(time),
          color('gray', '/iter'),
          ' ',
          id !== baseline &&
            color(
              timesSlower < 1 ? 'red' : 'green',
              `${
                formattedTimesSlower === '1.00' ? 'equal' : (
                  `${formattedTimesSlower}x ${
                    timesSlower < 1 ? 'faster' : 'slower'
                  }`
                )
              }`,
            ),
        ),
      )
    }
  })
}

type GroupArgs = [GroupConfig, (i: number) => void] | [(i: number) => void]

export function group(id: string, ...args: GroupArgs) {
  const fn = isFunction(args[0]) ? args[0] : args[1]!
  const options = (isFunction(args[0]) ? undefined : args[0]) as
    | GroupConfig
    | undefined

  groupBase({ id, fn, options })
}

group.only = (id: string, ...args: GroupArgs) => {
  const fn = isFunction(args[0]) ? args[0] : args[1]!
  const options = (isFunction(args[0]) ? undefined : args[0]) as
    | GroupConfig
    | undefined

  groupBase({ id, fn, options, only: true })
}

group.skip = (id: string, ...args: GroupArgs) => {
  const fn = isFunction(args[0]) ? args[0] : args[1]!
  const options = (isFunction(args[0]) ? undefined : args[0]) as
    | GroupConfig
    | undefined

  groupBase({ id, fn, options, skip: true })
}

export function run() {
  if (onlyRun.length > 0) {
    toRun = onlyRun
  }

  for (const fn of toRun) {
    fn()
  }

  console.log('\n')

  if (onlyRun.length > 0) {
    console.log(color('yellow', `Only running ${onlyRun.length} groups`))
  }

  if (skippedRuns > 0) {
    console.log(color('yellow', `Skipped ${skippedRuns} groups`))
  }

  console.log('\n')
}

const consoleColors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

function color(color: keyof typeof consoleColors, text: string) {
  return `${consoleColors[color]}${text}\x1b[0m`
}

function bold(text: string) {
  return `\x1b[1m${text}\x1b[0m`
}

type Options = {
  order?: 'asc' | 'desc'
}

export function sortBy<T>(
  arr: T[],
  getValueToSort: (item: T) => number | string,
  { order }: Options = {},
) {
  const reverse = order === 'asc'

  return [...arr].sort((a, b) => {
    const aPriority = getValueToSort(a)
    const bPriority = getValueToSort(b)

    if (aPriority < bPriority) {
      return reverse ? -1 : 1
    }

    if (aPriority > bPriority) {
      return reverse ? 1 : -1
    }

    return 0
  })
}

function getStats(timings: number[]): {
  min: number
  max: number
  avg: number
} {
  const sortedTimings = sortBy(timings, (time) => time, { order: 'asc' })

  const calcAvgBasedOn = sortedTimings.slice(
    0,
    Math.floor(sortedTimings.length * 0.5),
  )

  const min = calcAvgBasedOn[sortedTimings.findIndex((time) => time !== 0)]!
  const max = calcAvgBasedOn.at(-1)!

  const avg =
    calcAvgBasedOn.reduce((acc, curr) => acc + curr, 0) / calcAvgBasedOn.length

  return { min, max, avg }
}

function formatTime(ms: number) {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(3)}μs`
  }

  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`
  }

  return `${(ms / 1000).toFixed(2)}s`
}

type Arg = string | false | undefined | null

export function joinStrings(...args: (Arg | Arg[])[]) {
  const strings: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (!arg) continue

    if (Array.isArray(arg)) {
      strings.push(joinStrings(...arg))
      continue
    }

    strings.push(arg)
  }

  return strings.join('')
}
