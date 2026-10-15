import http from 'node:http';
import { app } from './app.js';
import { pool } from './db/pool.js';

const port = Number(process.env.PORT || 5000);
const server = http.createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`TechGear API listening on :${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('Database pool shutdown failed', error);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
