import { env, validateEnv } from './config/env.js';
import app from './app.js';

// Validate environment variables on startup
validateEnv();

const server = app.listen(env.PORT, () => {
  console.log(`API server running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

// Graceful shutdown handling
function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
