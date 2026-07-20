module.exports = {
  apps: [
    {
      name: "vpn-shop",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "700M",
      // single instance — SQLite + in-process chat state require one process.
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
