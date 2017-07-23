module.exports = {
  apps : [
    {
      name      : 'Image-Search-Abstraction-Layer',
      script    : 'server.js',
      watch     : true,
      env_production : {
        NODE_ENV: 'production'
      }
    }
  ]
};
