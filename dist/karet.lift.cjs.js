'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var I = require('infestines');
var K = require('kefir');
var L = require('partial.lenses');

//

var header = 'karet.lift:';

function warn(f) {
  if (!f.warned) {
    f.warned = 1;

    for (var _len = arguments.length, msg = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      msg[_key - 1] = arguments[_key];
    }

    console.warn.apply(console, [header].concat(msg, [Error().stack]));
  }
}

//

var isProperty = process.env.NODE_ENV === 'production' ? function (x) {
  return x instanceof K.Property;
} : function (x) {
  if (x instanceof K.Property) return true;
  if (x instanceof K.Observable) warn(isProperty, 'Encountered an observable that is not a property:\n', x, '\nYou need to explicitly convert observables to properties.\n');
  return false;
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

function inArgs(x, i, F, xi2yF) {
  var rec = function rec(x, i) {
    return isProperty(x) ? xi2yF(x, i) : I.isArray(x) ? L.elemsTotal(x, i, F, rec) : I.isObject(x) && x.$$typeof !== reactElement ? L.values(x, i, F, rec) : F.of(x);
  };
  return rec(x, i);
}

//

function maybeEmit(self) {
  var x = self._x;
  if (self._n & 1) {
    if (!L.all(hasValue, inArgs, x)) return;
    self._n ^= 1;
  }
  var y = self._f.apply(null, L.modify(inArgs, valueOf, x));
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
    }, inArgs, self._x);
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
    }, inArgs, self._x);
  }
});

var combineU = function combineU(xs, f) {
  return L.select(inArgs, xs) ? new Combine(xs, f) : f.apply(null, xs);
};

var combine = /*#__PURE__*/I.curry(combineU);

function liftFail(f) {
  throw Error('Arity of ' + f + ' unsupported');
}

function makeLift(stop) {
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
          return function () {
            return helper.apply(f, arguments);
          };
        case 1:
          return function (_1) {
            return helper.apply(f, arguments);
          };
        case 2:
          return function (_1, _2) {
            return helper.apply(f, arguments);
          };
        case 3:
          return function (_1, _2, _3) {
            return helper.apply(f, arguments);
          };
        case 4:
          return function (_1, _2, _3, _4) {
            return helper.apply(f, arguments);
          };
        default:
          return liftFail(f);
      }
    } else if (isProperty(f)) {
      return new Combine([f], liftRec);
    } else {
      return f;
    }
  }

  return function (fn) {
    var lifted = liftRec(fn);
    if (lifted !== fn) lifted.fn = fn;
    return lifted;
  };
}

var lift = /*#__PURE__*/makeLift(true);
var liftRec = /*#__PURE__*/makeLift(false);

exports.combine = combine;
exports.lift = lift;
exports.liftRec = liftRec;
