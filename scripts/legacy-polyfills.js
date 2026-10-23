/* Setcards for older iPads (Safari 12). The legacy build loads this before the app.
   Each piece only fills a gap, so it does nothing on newer browsers. */
(function () {
  'use strict';

  // Array.prototype.at (Safari 15.4)
  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true,
      writable: true,
      value: function (i) {
        var n = this.length;
        var k = i < 0 ? n + i : i;
        return k < 0 || k >= n ? undefined : this[k];
      }
    });
  }

  // Safari 12 names the audio class with a prefix
  if (!window.AudioContext && window.webkitAudioContext) window.AudioContext = window.webkitAudioContext;

  // File.arrayBuffer (Safari 14): used to read a Guitar Pro file picked from the device
  if (window.Blob && !Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function () {
      var blob = this;
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
      });
    };
  }

  // ResizeObserver (Safari 13.1). Sizes are checked when the window changes size, which is when a layout changes.
  if (!window.ResizeObserver) {
    var observers = [];
    var checkAll = function () {
      observers.forEach(function (ro) {
        var entries = [];
        ro._items.forEach(function (item) {
          var w = item.el.clientWidth;
          var h = item.el.clientHeight;
          if (w !== item.w || h !== item.h) {
            item.w = w;
            item.h = h;
            entries.push({ target: item.el, contentRect: { width: w, height: h } });
          }
        });
        if (entries.length) ro._cb(entries, ro);
      });
    };
    window.addEventListener('resize', checkAll);
    window.addEventListener('orientationchange', function () { setTimeout(checkAll, 300); });
    window.ResizeObserver = function (callback) { this._cb = callback; this._items = []; observers.push(this); };
    window.ResizeObserver.prototype.observe = function (el) {
      this._items.push({ el: el, w: -1, h: -1 });
      setTimeout(checkAll, 0);
    };
    window.ResizeObserver.prototype.unobserve = function (el) {
      this._items = this._items.filter(function (item) { return item.el !== el; });
    };
    window.ResizeObserver.prototype.disconnect = function () { this._items = []; };
  }

  // The app sets --seg to a colour token (var(--c-chorus)). The legacy CSS mixes colours with rgba(),
  // which needs the colour as r, g, b, so --seg-rgb is worked out whenever --seg is set.
  var hexToRgb = function (hex) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].split('').map(function (c) { return c + c; }).join('') : m[1];
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(', ');
  };
  var rgbOf = function (value) {
    var token = /^var\((--[\w-]+)\)$/.exec(value.trim());
    var hex = token
      ? getComputedStyle(document.documentElement).getPropertyValue(token[1])
      : value;
    return hexToRgb(hex || '');
  };
  var nativeSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
    nativeSetProperty.call(this, name, value, priority);
    if (name === '--seg') {
      var rgb = rgbOf(String(value));
      if (rgb) nativeSetProperty.call(this, '--seg-rgb', rgb, priority);
    }
  };
})();
