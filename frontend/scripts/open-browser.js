const { exec } = require('child_process');

const url = process.argv[2] || 'http://localhost:3000';

const command =
  process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

exec(command, (err) => {
  if (err) {
    console.error(`Could not auto-open browser: ${err.message}`);
    console.error(`Open it manually: ${url}`);
  }
});
