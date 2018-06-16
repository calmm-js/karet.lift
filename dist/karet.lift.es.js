import { defineNameU, isArray, isObject, identicalU, inherit, curry, isFunction } from 'infestines';
import { Property, Observable } from 'kefir';
import { elemsTotal, values, all, modify, forEach, select } from 'partial.lenses';

//

var setName = process.env.NODE_ENV === 'production' ? function (x) {
  return x;
} : function (to, name) {
  return defineNameU(to, name);
};

var copyName = process.env.NODE_ENV === 'production' ? function (x) {
  return x;
} : function (to, from) {
  return defineNameU(to, from.name);
};

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
  return x instanceof Property;
} : function (x) {
  if (x instanceof Property) return true;
  if (x instanceof Observable) warn(isProperty, 'Encountered an observable that is not a property:\n', x, '\nYou need to explicitly convert observables to properties.\n');
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
    return isProperty(x) ? xi2yF(x, i) : isArray(x) ? elemsTotal(x, i, F, rec) : isObject(x) && x.$$typeof !== reactElement ? values(x, i, F, rec) : F.of(x);
  };
  return rec(x, i);
}

//

function maybeEmit(self) {
  var x = self._x;
  if (self._n & 1) {
    if (!all(hasValue, inArgs, x)) return;
    self._n ^= 1;
  }
  var y = self._f.apply(null, modify(inArgs, valueOf, x));
  var c = currentEvent(self);
  if (!c || !identicalU(y, c.value)) self._emitValue(y);
}

var Combine = /*#__PURE__*/inherit(function Combine(xs, f) {
  var self = this;
  Property.call(self);
  self._f = f;
  self._x = xs;
  self._h = null;
  self._n = 1;
}, Property, {
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
    forEach(function (p) {
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
    forEach(function (p) {
      return p.offAny(h);
    }, inArgs, self._x);
  }
});

var combineU = function combine(xs, f) {
  return select(inArgs, xs) ? new Combine(xs, f) : f.apply(null, xs);
};

var combine = /*#__PURE__*/curry(combineU);

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
    if (isFunction(f)) {
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

export { combine, lift, liftRec };
