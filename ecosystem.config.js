module.exports = {
  apps: [
    {
      name: 'occupy-mars',
      script: 'server/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production'
      },
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
