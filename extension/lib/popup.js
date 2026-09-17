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
   *   p.wordRect         optional {left,top,right,bottom} of the hovered word.
   *                      When present the card is anchored below the whole line
   *                      (word.bottom) instead of the cursor, so it clears the
   *                      same-line next word a learner is reading toward.
   *   p.popupW/popupH    measured popup size
   *   p.viewportW/viewportH
   *   p.offset           gap between anchor and popup (default 14)
   * @returns {{left:number, top:number, placement:string}}
   */
  function positionPopup(p) {
    var off = p.offset == null ? 14 : p.offset;
    var margin = 8;
    var wr = p.wordRect;
    var left, top;
    if (wr) {
      left = wr.left;          // drop straight down from the word
      top = wr.bottom + off;   // below the whole line, not over the next word
    } else {
      left = p.cursorX + off;
      top = p.cursorY + off;
    }
    var placement = 'below-right';

    if (left + p.popupW + margin > p.viewportW) {
      // shift back to fit under the line (word-anchored) / flip left of cursor
      left = wr ? p.viewportW - p.popupW - margin : p.cursorX - off - p.popupW;
      placement = 'below-left';
    }
    if (left < margin) left = margin;

    if (top + p.popupH + margin > p.viewportH) {
      // flip above the line (word-anchored) / above the cursor
      top = wr ? wr.top - off - p.popupH : p.cursorY - off - p.popupH;
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
