/* Display-only changes to the score: the side sticks of the click, and the % marks of repeated bars. They change how a
   score is drawn and played, not what is saved, so each one is taken out while a file is written and put back after.
   A layer is { hide(), show() }. without(fn) hides every layer, runs fn, and shows them again, even if fn throws. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  function create() {
    const layers = [];
    return {
      add(layer) { layers.push(layer); return layer; },
      without(fn) {
        layers.forEach((l) => l.hide());
        try { return fn(); } finally {
          for (let i = layers.length - 1; i >= 0; i--) layers[i].show();
        }
      }
    };
  }

  SM.overlays = { create };
})(typeof window !== 'undefined' ? window : globalThis);
