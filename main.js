const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path');
const net = require('net');

const { spawn } = require('child_process');

let serverProcess;


const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        }
    })
    win.loadURL("http://localhost:8069/pos/ui?config_id=1")
    win.webContents.openDevTools();
}

const findAvailablePort = (start = 5050, end = 6000) => {
    return new Promise((resolve, reject) => {
        const tryPort = (port) => {
            const server = net.createServer();
            server.unref();
            server.on('error', () => {
                if (port < end) {
                    tryPort(port + 1);
                } else {
                    reject(new Error('No available port found'));
                }
            });
            server.listen(port, () => {
                server.close(() => resolve(port));
            });
        };
        tryPort(start);
    });
};

let dynamicPort = null;

const startPrintService = async() => {

    const isDev = !app.isPackaged;
    const binaryName = process.platform === 'win32' ? 'main.exe' : 'main';
    
    // Determine the platform-specific build path
    const platformDir = process.platform === 'win32' ? 'win-x64' : 'linux-x64';
    
    const buildOutputPath = isDev
        ? path.join(__dirname, 'build', platformDir)
        : path.join(process.resourcesPath, 'build', platformDir);

    const serverExePath = path.join(buildOutputPath, binaryName);

    // Debug logging
    console.log('=== Print Service Configuration ===');
    console.log(`Platform: ${process.platform}`);
    console.log(`Is Development: ${isDev}`);
    console.log(`Platform Directory: ${platformDir}`);
    console.log(`Build Output Path: ${buildOutputPath}`);
    console.log(`Server Executable Path: ${serverExePath}`);
    console.log('=================================');

    // Check if the executable exists
    const fs = require('fs');
    if (!fs.existsSync(serverExePath)) {
        console.error(`ERROR: Print service executable not found at: ${serverExePath}`);
        console.error(`Make sure you have built the ${platformDir} executable.`);
        return;
    }

    console.log('Starting print service...');
            const port = await findAvailablePort(5050, 6000);
            dynamicPort = port;

            console.log("Server runnnig on this port : [ ",port," ]");
            
            serverProcess = spawn(serverExePath, [`--port=${port}`], {
                detached: false,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: false,
            });

            serverProcess.stdout.on('data', (data) => {
                console.log(`[PrintService OUT]: ${data.toString().trim()}`);
            });

            serverProcess.stderr.on('data', (data) => {
                console.error(`[PrintService ERR]: ${data.toString().trim()}`);
            });

            serverProcess.on('exit', (code, signal) => {
                console.log(`[PrintService EXIT]: code=${code} signal=${signal}`);
            });

  
  
}

const stopPrintService = () => {
    if (serverProcess && !serverProcess.killed) {
        console.log("Killing print service...");
        serverProcess.kill();
    }
};

app.whenReady().then(() => {
    startPrintService();
    createWindow();
})

app.on('before-quit', () => {
    stopPrintService();
});

ipcMain.handle('get-print-port', () => {
    return dynamicPort;
});

