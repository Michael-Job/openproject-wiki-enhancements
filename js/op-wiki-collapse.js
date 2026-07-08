/* ============================================================
   OpenProject Wiki – Collapse sidebar tree to current path
   Tested with: OpenProject Community 16.6.3
   Injected via Apache mod_substitute before </body>
   (see /apache/op-custom-vhost.conf).

   Problem solved:
   OpenProject permanently remembers expanded sidebar nodes.
   Over time, the wiki tree grows cluttered with all previously
   visited branches open. This script collapses everything except
   the path to the currently active page on every page load and
   on every SPA navigation.

   How it works:
   - Uses OP's native Stimulus toggle (.tree-menu--hierarchy-indicator).
   - Fires a real MouseEvent — .click() does NOT trigger the Stimulus
     handler reliably (tested on OP 16.6.3).
   - Waits for the tree and the active selection to be rendered (Angular
     is async), then collapses off-path nodes deepest-first.
   - Hooks into History API (pushState/replaceState) + popstate to handle
     SPA navigation without full page reloads.

   DOM selectors used (verify after major OP upgrades):
   - ul.pages-hierarchy          child list of a parent node
   - li.-hierarchy-expanded      expanded parent node
   - .tree-menu--item.-selected  currently active page
   - .tree-menu--hierarchy-indicator  the toggle button
   ============================================================ */
(function () {
  'use strict';

  var lastPath = location.pathname + location.search;

  function fireClick(el) {
    el.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, view: window
    }));
  }

  function collapseOffPath() {
    var sel = document.querySelector('.tree-menu--item.-selected');

    // All expanded parent nodes NOT on the path to the active page
    var open = Array.prototype.slice
      .call(document.querySelectorAll('li.-hierarchy-expanded'))
      .filter(function (li) { return li.querySelector(':scope > ul.pages-hierarchy'); })
      .filter(function (li) { return !(sel && li.contains(sel)); });

    // Collapse deepest first so each toggle is still visible when clicked
    open.sort(function (a, b) {
      return b.querySelectorAll('li').length - a.querySelectorAll('li').length;
    });

    open.forEach(function (li) {
      var t = li.querySelector(':scope > .tree-menu--item .tree-menu--hierarchy-indicator');
      if (t) fireClick(t);
    });
  }

  // Wait until both the tree and the active selection are rendered, then collapse.
  // Angular renders asynchronously, so we poll until ready (max ~4 s).
  function waitAndCollapse(tries) {
    tries = tries || 0;
    var tree = document.querySelector('ul.pages-hierarchy');
    var sel  = document.querySelector('.tree-menu--item.-selected');
    if (tree && sel) {
      collapseOffPath();
      setTimeout(collapseOffPath, 500);   // second pass for late-rendered nodes
      return;
    }
    if (tries < 40) setTimeout(function () { waitAndCollapse(tries + 1); }, 100);
  }

  function onNav() {
    var now = location.pathname + location.search;
    if (now === lastPath) return;
    lastPath = now;
    waitAndCollapse();
  }

  // Intercept SPA navigation (Angular uses the History API)
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      var r = orig.apply(this, arguments);
      onNav();
      return r;
    };
  });
  window.addEventListener('popstate', onNav);

  // Initial run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitAndCollapse(); });
  } else {
    waitAndCollapse();
  }
})();
