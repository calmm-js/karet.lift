import * as I from 'infestines'
import * as K from 'kefir'
import * as L from 'partial.lenses'
import * as R from 'ramda'
import * as React from 'karet'

const C = K.constant

import {combine, lift, liftRec} from '../dist/karet.lift.cjs'

function show(x) {
  switch (typeof x) {
    case 'string':
    case 'object':
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

export const Bus = I.inherit(
  function Bus() {
    K.Stream.call(this)
  },
  K.Stream,
  {
    push: K.Stream.prototype._emitValue,
    error: K.Stream.prototype._emitError,
    end: K.Stream.prototype._emitEnd
  }
)

const toExpr = f =>
  f
    .toString()
    .replace(/\s+/g, ' ')
    .replace(/^\s*function\s*\(\s*\)\s*{\s*(return\s*)?/, '')
    .replace(/\s*;?\s*}\s*$/, '')
    .replace(/function\s*(\([a-zA-Z0-9, ]*\))\s*/g, '$1 => ')
    .replace(/\(([^),]+)\) =>/, '$1 =>')
    .replace(/{\s*return\s*([^{;]+)\s*;\s*}/g, '$1')
    .replace(/\(0, [^.]*[.]([^)]*)\)/g, '$1')

const testEq = (expect, thunk) =>
  it(`${toExpr(thunk)} => ${show(expect)}`, done => {
    const actual = thunk()
    function check(actual) {
      if (!R.equals(actual, expect))
        throw new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
      done()
    }
    if (actual instanceof K.Property) {
      actual.take(1).observe({value: check, error: check})
    } else {
      check(actual)
    }
  })

describe('combine', () => {
  testEq([true, false], () => {
    const o = {x: 1}
    return combine([o, {x: C(1)}], (x, y) => [x === o, y === o])
  })

  testEq(
    [{type: 'value', value: 2}, {type: 'value', value: 3}, {type: 'end'}],
    () => {
      const xB = new Bus()
      const events = []

      combine([xB.toProperty()], x => x + 1).onAny(e => events.push(e))

      xB.push(1)
      xB.push(2)
      xB.push(2)
      xB.end()

      return events
    }
  )

  testEq(
    [
      {type: 'error', value: 'foo'},
      {type: 'value', value: [1, 2]},
      {type: 'error', value: 'bar'},
      {type: 'value', value: [4, 3]},
      {type: 'end'}
    ],
    () => {
      const xB = new Bus()
      const yB = new Bus()
      const events = []

      combine([xB.toProperty(), yB.toProperty()], (x, y) => [x, y]).onAny(e =>
        events.push(e)
      )

      yB.error('foo')
      xB.push(1)
      yB.push(2)
      xB.error('bar')
      yB.push(3)
      yB.end()
      xB.push(4)
      xB.end()

      return events
    }
  )

  const element = React.createElement('h1', null, C('Hello!'))

  testEq(element, () => combine([element], I.id))
})

describe('lift', () => {
  const get = lift(L.get)
  const apply = liftRec(R.apply)

  testEq(101, () => get(C('x'), C({x: 101})))

  testEq(101, () => apply(get(C('x')), [C({x: 101})]))

  testEq(true, () => {
    const x = C(101)
    return get('x', C({x})).map(r => r === x)
  })

  testEq(true, () => L.get === get.fn)

  testEq([1, [undefined], undefined, 2], () =>
    lift((x, y, z, w) => [x, y, z, w])(1, [C(undefined)], undefined, C(2))
  )
})

describe('liftRec', () => {
  const __ = liftRec(R.__)
  const add = liftRec(R.add)
  const append = liftRec(R.append)
  const apply = liftRec(R.apply)
  const compose = liftRec(R.compose)
  const equals = liftRec(R.equals)
  const filter = liftRec(R.filter)
  const flip = liftRec(R.flip)
  const gt = liftRec(R.gt)
  const modulo = liftRec(R.modulo)
  const pipe = liftRec(R.pipe)
  const propEq = liftRec(R.propEq)
  const range = liftRec(R.range)
  const take = liftRec(R.take)
  const transduce = liftRec(R.transduce)

  testEq(true, () => R.add === add.fn)

  testEq(3, () => add(1)(C(2)))
  testEq(3, () => add(C(1), C(2)))

  testEq(-1, () => pipe(x => x - 1, x => -x)(C(2)))
  testEq(-1, () => apply(pipe(add(C(-1)), x => -x), [C(2)]))
  testEq(-1, () => apply(pipe(add(__, C(-1)), x => -x), [C(2)]))

  testEq([1, 1], () => filter(gt(C(2)), C([3, 1, 4, 1])))
  testEq([3, 4], () => filter(gt(__, C(2)), C([3, 1, 4, 1])))

  testEq(true, () => propEq(C('x'), 10, {x: 10}))

  testEq([1, 3, 5], () =>
    transduce(
      compose(filter(pipe(modulo(__, C(2)), equals(C(1)))), take(C(3))),
      flip(append),
      C([]),
      range(0, C(100))
    )
  )

  it('Throws on unsupported arity', () => {
    let raised
    try {
      liftRec((_1, _2, _3, _4, _5) => {})
      raised = false
    } catch (e) {
      raised = true
    }
    if (!raised) throw Error('Expected to throw')
  })
})

if (process.env.NODE_ENV !== 'production')
  describe('diagnostics', () => {
    it('warns about non-properties', () => {
      combine([K.interval(10, 'a')], I.id)
    })
  })
