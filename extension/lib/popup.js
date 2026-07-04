/**
 * KhmerLens popup positioning math. Pure, testable.
 */
(function (root) {
  'use strict';

  /**
   * Compute fixed-position coordinates for the popup card.
   *
   * @param {object} p
   *   p.cursorX/cursorY  mouse position (viewport coords)
   *   p.popupW/popupH    measured popup size
   *   p.viewportW/viewportH
   *   p.offset           gap between cursor and popup (default 14)
   * @returns {{left:number, top:number, placement:string}}
   */
  function positionPopup(p) {
    var off = p.offset == null ? 14 : p.offset;
    var margin = 8;
    var left = p.cursorX + off;
    var top = p.cursorY + off;
    var placement = 'below-right';

    if (left + p.popupW + margin > p.viewportW) {
      left = p.cursorX - off - p.popupW; // flip left
      placement = 'below-left';
    }
    if (left < margin) left = margin;

    if (top + p.popupH + margin > p.viewportH) {
      top = p.cursorY - off - p.popupH; // flip above
      placement = placement.replace('below', 'above');
    }
    if (top < margin) top = margin;

    return { left: Math.round(left), top: Math.round(top), placement: placement };
  }

  var api = { positionPopup: positionPopup };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.KhmerLensPopup = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
