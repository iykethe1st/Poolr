const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Intercept transformer failures so the real error surfaces in EAS logs
const baseReporter = config.reporter;
config.reporter = {
  update(event) {
    if (event.type === 'transformer_load_failed') {
      const err = event.error;
      console.error('\n[POOLR] ===== TRANSFORMER LOAD FAILED =====');
      console.error('[POOLR] Error message:', err?.message);
      console.error('[POOLR] Error stack:', err?.stack);
      console.error('[POOLR] transformerPath:', config.transformerPath);
      console.error('[POOLR] watchFolders:', JSON.stringify(config.watchFolders));
      console.error('[POOLR] ==========================================\n');
      process.exit(1);
    }
    baseReporter.update(event);
  },
};

module.exports = config;
