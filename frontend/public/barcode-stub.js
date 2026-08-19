// Force qr-scanner to use its wasm-based scanner instead of the native BarcodeDetector API
// (kept as an external file so a strict Content-Security-Policy without 'unsafe-inline' works)
try {
  window.BarcodeDetector = {getSupportedFormats: async () => []}
} catch (e) {
  console.error('Error setting BarcodeDetector:', e)
}
