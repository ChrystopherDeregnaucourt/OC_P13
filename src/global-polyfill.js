/**
 * Polyfill: sockjs-client requires the Node.js 'global' object.
 * In browsers, 'global' does not exist. This shim maps it to 'window'.
 */
if (typeof global === 'undefined') {
  window.global = window;
}
