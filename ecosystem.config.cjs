module.exports = {
  apps: [
    {
      name: "sema",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/sema-error.log",
      out_file: "./logs/sema-out.log",
      merge_logs: true,
      windowsHide: true,
    },
  ],
};
