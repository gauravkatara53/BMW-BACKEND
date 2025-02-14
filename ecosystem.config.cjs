module.exports = {
  apps: [
    {
      name: 'backend',
      script: './src/index.js',
      interpreter: 'node',
      args: '--experimental-specifier-resolution=node',
    },
    {
      name: 'worker',
      script: './src/Queue/paymentQueue.js',
      interpreter: 'node',
      args: '--experimental-specifier-resolution=node',
    },
  ],
};
