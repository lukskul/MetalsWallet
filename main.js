const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let serverProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, 'public', 'coin.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // optional
    },
  });

  win.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  // Start Express server
  serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    shell: true,
  });

  serverProcess.stdout.on('data', data => {
    console.log(`[Server]: ${data}`);
  });

  serverProcess.stderr.on('data', data => {
    console.error(`[Server Error]: ${data}`);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
