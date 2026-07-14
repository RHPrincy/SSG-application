// pm2 configuration — alternative to Docker for running the app on the VPS.
//
//   npm ci && npm run build
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup
//
// Requires: Node >= 18, and `npx playwright install --with-deps chromium`
// run once so the browser + system libs are present, plus the Vercel CLI
// installed globally (`npm i -g vercel`).
module.exports = {
  apps: [
    {
      name: 'prerender-manager',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: __dirname,
      instances: 1, // Single instance: job/log state lives in memory + data/.
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
