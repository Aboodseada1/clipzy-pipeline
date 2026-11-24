module.exports = {
  apps: [
    {
      name: "clipzy",
      script: "node_modules/.bin/next",
      args: "start -p 3200",
      cwd: "/var/www/clipzy.aaseada.com",
      env: {
        NODE_ENV: "production",
        PORT: 3200,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
  ],
};
