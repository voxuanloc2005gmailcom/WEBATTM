// Compatibility entrypoint for local tooling that still invokes node server.js.
// The canonical server lives in src/server.js; import it exactly once.
import './src/server.js';
