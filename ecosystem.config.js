module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'src/index.js', // Replace with your backend entry file
      exec_mode: 'fork',
    },
    {
      name: 'worker',
      script: 'src/Queue/paymentQueue.js', // Your Redis worker
      exec_mode: 'fork',
    },
  ],
};
