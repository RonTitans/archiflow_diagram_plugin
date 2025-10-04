// ArchiFlow Custom PreConfig.js for Draw.io
// This file loads before Draw.io initializes and sets configuration

window.DRAWIO_BASE_URL = '/';
window.DRAWIO_VIEWER_URL = null;
window.DRAWIO_LIGHTBOX_URL = null;

// Set URL parameters to load plugins from same origin
// The 'p' parameter accepts plugin URLs separated by semicolons
window.urlParams = window.urlParams || {};
window.urlParams['p'] = '/plugins/archiflow-network-plugin.js';

console.log('[ArchiFlow] PreConfig.js loaded - Network plugin URL set:', window.urlParams['p']);