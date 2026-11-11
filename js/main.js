// Startup: runs once when the page loads.
(function () {
  'use strict';
  // Left over from the setup test page. Safe to remove once it has run on every install.
  window.localStorage.removeItem('algebraQuest.probe');
  AQ.ui.mount(document.getElementById('app'), window.localStorage);
})();
