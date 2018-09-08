(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('infestines'), require('kefir'), require('partial.lenses')) :
  typeof define === 'function' && define.amd ? define(['exports', 'infestines', 'kefir', 'partial.lenses'], factory) :
  (factory((global.karet = global.karet || {}, global.karet.lift = {}),global.I,global.Kefir,global.L));
}(this, (function (exports,I,K,L) { 'use strict';

  //

  var setName = function (to, name) {
    return I.defineNameU(to, name);
  };

  var copyName = function (to, from) {
    return I.defineNameU(to, from.name);
  };

  //

  var isStream = function isStream(x) {
    return x instanceof K.Stream;
  };
  var isProperty = function isProperty(x) {
    return x instanceof K.Property;
  };

  //

  var currentEvent = function currentEvent(p) {
    return p._currentEvent;
  };

  function hasValue(p) {
    var ce = currentEvent(p);
    return ce && ce.type === 'value';
  }

  var valueOf = function valueOf(p) {
    return currentEvent(p).value;
  };

  //

  var reactElement = /*#__PURE__*/Symbol.for('react.element');

  //

  var inTemplate = function inTemplate(predicate) {
    return function inTemplate(x, i, F, xi2yF) {
      var rec = function rec(x, i) {
        return predicate(x) ? xi2yF(x, i) : I.isArray(x) ? L.elemsTotal(x, i, F, rec) : I.isObject(x) && x.$$typeof !== reactElement ? L.values(x, i, F, rec) : F.of(x);
      };
      return rec(x, i);
    };
  };

  var properties = /*#__PURE__*/inTemplate(isProperty);
  var streams = /*#__PURE__*/inTemplate(isStream);

  //

  function maybeEmit(self) {
    var x = self._x;
    if (self._n & 1) {
      if (!L.all(hasValue, properties, x)) return;
      self._n ^= 1;
    }
    var y = self._f.apply(null, L.modify(properties, valueOf, x));
    var c = currentEvent(self);
    if (!c || !I.identicalU(y, c.value)) self._emitValue(y);
  }

  var Combine = /*#__PURE__*/I.inherit(function Combine(xs, f) {
    var self = this;
    K.Property.call(self);
    self._f = f;
    self._x = xs;
    self._h = null;
    self._n = 1;
  }, K.Property, {
    _onActivation: function _onActivation() {
      var self = this;
      function h(e) {
        var t = e.type;
        if (t === 'value') {
          if (self._h) maybeEmit(self);
        } else if (t === 'error') {
          self._n |= 1;
          self._emitError(e.value);
        } else {
          if ((self._n -= 2) < 2 && self._h) {
            self._h = null;
            self._emitEnd();
          }
        }
      }
      L.forEach(function (p) {
        self._n += 2;
        p.onAny(h);
      }, properties, self._x);
      maybeEmit(self);
      if (1 < self._n) {
        self._h = h;
      } else {
        self._emitEnd();
      }
    },
    _onDeactivation: function _onDeactivation() {
      var self = this;
      var h = self._h;
      self._h = null;
      self._n = 1;
      L.forEach(function (p) {
        return p.offAny(h);
      }, properties, self._x);
    }
  });

  var nameAsStack = function (fn) {
    var _Error = Error(),
        stack = _Error.stack;

    return stack ? I.defineNameU(function () {
      return fn.apply(null, arguments);
    }, stack.replace(/^(.*[\n]){6}\s*at\s/, '').replace(/[\n]/g, '\n   ') + '\n       in') : fn;
  };

  var combineU = /*#__PURE__*/(function (fn) {
    return function combine(xs, f) {
      if (!combineU.w && L.get(streams, xs)) {
        combineU.w = 1;
        console.warn('karet.lift: Stream(s) passed to `combine(..., ' + (f.name || '<anonymous fn>') + ')`:\n', xs, '\nat:', Error().stack);
      }
      return fn(xs, f);
    };
  })(function combine(xs, f) {
    return L.get(properties, xs) ? new Combine(xs, nameAsStack(f)) : f.apply(null, xs);
  });

  var combine = /*#__PURE__*/I.curry(combineU);

  function liftFail(f) {
    throw Error('Arity of ' + f + ' unsupported');
  }

  function makeLift(stop, name) {
    function helper() {
      var n = arguments.length;
      var xs = Array(n);
      for (var i = 0; i < n; ++i) {
        xs[i] = arguments[i];
      }var r = combineU(xs, this);
      return stop && this.length <= n ? r : liftRec(r);
    }

    function liftRec(f) {
      if (I.isFunction(f)) {
        switch (f.length) {
          case 0:
            return copyName(function () {
              return helper.apply(f, arguments);
            }, f);
          case 1:
            return copyName(function (_1) {
              return helper.apply(f, arguments);
            }, f);
          case 2:
            return copyName(function (_1, _2) {
              return helper.apply(f, arguments);
            }, f);
          case 3:
            return copyName(function (_1, _2, _3) {
              return helper.apply(f, arguments);
            }, f);
          case 4:
            return copyName(function (_1, _2, _3, _4) {
              return helper.apply(f, arguments);
            }, f);
          default:
            return liftFail(f);
        }
      } else if (isProperty(f)) {
        return new Combine([f], liftRec);
      } else {
        return f;
      }
    }

    return setName(function (fn) {
      var lifted = liftRec(fn);
      if (lifted !== fn) lifted.fn = fn;
      return lifted;
    }, name);
  }

  var lift = /*#__PURE__*/makeLift(true, 'lift');
  var liftRec = /*#__PURE__*/makeLift(false, 'liftRec');

  exports.inTemplate = inTemplate;
  exports.combine = combine;
  exports.lift = lift;
  exports.liftRec = liftRec;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
