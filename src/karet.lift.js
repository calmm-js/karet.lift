import * as I from 'infestines'
import * as K from 'kefir'
import * as L from 'partial.lenses'

//

const setName =
  process.env.NODE_ENV === 'production'
    ? x => x
    : (to, name) => I.defineNameU(to, name)

const copyName =
  process.env.NODE_ENV === 'production'
    ? x => x
    : (to, from) => I.defineNameU(to, from.name)

//

const isStream = x => x instanceof K.Stream
const isProperty = x => x instanceof K.Property

//

const currentEvent = p => p._currentEvent

function hasValue(p) {
  const ce = currentEvent(p)
  return ce && ce.type === 'value'
}

const valueOf = p => currentEvent(p).value

//

const reactElement = Symbol.for('react.element')

//

const mkInArgs = predicate =>
  function inArgs(x, i, F, xi2yF) {
    const rec = (x, i) =>
      predicate(x)
        ? xi2yF(x, i)
        : I.isArray(x)
          ? L.elemsTotal(x, i, F, rec)
          : I.isObject(x) && x.$$typeof !== reactElement
            ? L.values(x, i, F, rec)
            : F.of(x)
    return rec(x, i)
  }

const inArgs = mkInArgs(isProperty)
const inArgsStream = mkInArgs(isStream)

//

function maybeEmit(self) {
  const x = self._x
  if (self._n & 1) {
    if (!L.all(hasValue, inArgs, x)) return
    self._n ^= 1
  }
  const y = self._f.apply(null, L.modify(inArgs, valueOf, x))
  const c = currentEvent(self)
  if (!c || !I.identicalU(y, c.value)) self._emitValue(y)
}

const Combine = I.inherit(
  function Combine(xs, f) {
    const self = this
    K.Property.call(self)
    self._f = f
    self._x = xs
    self._h = null
    self._n = 1
  },
  K.Property,
  {
    _onActivation() {
      const self = this
      function h(e) {
        const t = e.type
        if (t === 'value') {
          if (self._h) maybeEmit(self)
        } else if (t === 'error') {
          self._n |= 1
          self._emitError(e.value)
        } else {
          if ((self._n -= 2) < 2 && self._h) {
            self._h = null
            self._emitEnd()
          }
        }
      }
      L.forEach(
        p => {
          self._n += 2
          p.onAny(h)
        },
        inArgs,
        self._x
      )
      maybeEmit(self)
      if (1 < self._n) {
        self._h = h
      } else {
        self._emitEnd()
      }
    },
    _onDeactivation() {
      const self = this
      const h = self._h
      self._h = null
      self._n = 1
      L.forEach(p => p.offAny(h), inArgs, self._x)
    }
  }
)

const nameAsStack =
  process.env.NODE_ENV === 'production'
    ? x => x
    : fn => {
        const {stack} = Error()
        return I.defineNameU(function() {
          return fn.apply(null, arguments)
        }, `${stack
          .replace(/^(.*[\n]){6}\s*at\s/, '')
          .replace(/[\n]/g, '\n   ')}\n       in`)
      }

const combineU = (process.env.NODE_ENV === 'production'
  ? I.id
  : fn =>
      function combine(xs, f) {
        if (!combineU.w && L.select(inArgsStream, xs)) {
          combineU.w = 1
          console.warn(
            `karet.lift: Stream(s) passed to \`combine(..., ${f.name ||
              '<anonymous fn>'})\`:\n`,
            xs,
            `\nat:`,
            Error().stack
          )
        }
        return fn(xs, f)
      })(function combine(xs, f) {
  return L.select(inArgs, xs)
    ? new Combine(xs, nameAsStack(f))
    : f.apply(null, xs)
})

export const combine = I.curry(combineU)

function liftFail(f) {
  throw Error(`Arity of ${f} unsupported`)
}

function makeLift(stop, name) {
  function helper() {
    const n = arguments.length
    const xs = Array(n)
    for (let i = 0; i < n; ++i) xs[i] = arguments[i]
    const r = combineU(xs, this)
    return stop && this.length <= n ? r : liftRec(r)
  }

  function liftRec(f) {
    if (I.isFunction(f)) {
      switch (f.length) {
        case 0:
          return copyName(function() {
            return helper.apply(f, arguments)
          }, f)
        case 1:
          return copyName(function(_1) {
            return helper.apply(f, arguments)
          }, f)
        case 2:
          return copyName(function(_1, _2) {
            return helper.apply(f, arguments)
          }, f)
        case 3:
          return copyName(function(_1, _2, _3) {
            return helper.apply(f, arguments)
          }, f)
        case 4:
          return copyName(function(_1, _2, _3, _4) {
            return helper.apply(f, arguments)
          }, f)
        default:
          return liftFail(f)
      }
    } else if (isProperty(f)) {
      return new Combine([f], liftRec)
    } else {
      return f
    }
  }

  return setName(fn => {
    const lifted = liftRec(fn)
    if (lifted !== fn) lifted.fn = fn
    return lifted
  }, name)
}

export const lift = makeLift(true, 'lift')
export const liftRec = makeLift(false, 'liftRec')
