const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path');
const net = require('net');

const { spawn } = require('child_process');

let serverProcess;


let mainWindow;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        }
    })
    
    // Load the startup screen first
    mainWindow.loadFile('startup.html');
    
    // win.webContents.openDevTools();
}

const findAvailablePort = (start = 5050, end = 6000) => {
    return new Promise((resolve, reject) => {
        const tryPort = (port) => {
            const server = net.createServer();

            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    if (port < end) {
                        tryPort(port + 1);
                    } else {
                        reject(new Error('No available port found'));
                    }
                } else {
                    reject(err);
                }
            });

            server.once('listening', () => {
                server.close(() => {
                    resolve(port);
                });
            });

            server.listen(port, '127.0.0.1');
        };

        tryPort(start);
    });
};




let dynamicPort = null;

const startPrintService = async () => {

    const isDev = !app.isPackaged;
    const binaryName = process.platform === 'win32' ? 'main.exe' : 'main';

    // Determine the platform-specific build path
    const platformDir = process.platform === 'win32' ? 'win-x64' : 'linux-x64';

    let buildOutputPath;
    if (isDev) {
        // Development mode - look in project build directory
        buildOutputPath = path.join(__dirname, 'build', platformDir);
    } else {
        // Production mode - electron-builder extraResources path
        buildOutputPath = path.join(process.resourcesPath, 'build', platformDir);
    }

    const serverExePath = path.join(buildOutputPath, binaryName);

    // Debug logging
    console.log('=== Print Service Configuration ===');
    console.log(`Platform: ${process.platform}`);
    console.log(`Is Development: ${isDev}`);
    console.log(`Platform Directory: ${platformDir}`);
    console.log(`Process Resources Path: ${process.resourcesPath}`);
    console.log(`Process Exec Path: ${process.execPath}`);
    console.log(`__dirname: ${__dirname}`);
    console.log(`Build Output Path: ${buildOutputPath}`);
    console.log(`Server Executable Path: ${serverExePath}`);
    console.log('=================================');

    // Check if the executable exists
    const fs = require('fs');
    if (!fs.existsSync(serverExePath)) {
        console.error(`ERROR: Print service executable not found at: ${serverExePath}`);
        console.error(`Make sure you have built the ${platformDir} executable.`);

        // List contents of build output directory for debugging
        const buildDir = path.dirname(serverExePath);
        if (fs.existsSync(buildDir)) {
            console.log(`\nContents of ${buildDir}:`);
            try {
                const files = fs.readdirSync(buildDir);
                files.forEach(file => {
                    console.log(`  - ${file}`);
                });
            } catch (err) {
                console.error(`Error reading directory: ${err.message}`);
            }
        } else {
            console.error(`Build directory does not exist: ${buildDir}`);
        }
        return;
    }

    console.log('Starting print service...');
    const port = await findAvailablePort(5050, 6000);
    console.log("port", port);

    dynamicPort = port;

    console.log("Server runnnig on this port : [ ", port, " ]");

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
    return new Promise((resolve) => {
        if (!serverProcess || serverProcess.killed) {
            console.log("Print service already stopped or not running.");
            resolve();
            return;
        }

        console.log(`Stopping print service (PID: ${serverProcess.pid})...`);

        if (process.platform === 'win32') {
            // Use both spawn and exec methods for more reliable termination
            const { exec, spawn } = require('child_process');

            // First try taskkill with force and tree kill
            exec(`taskkill /pid ${serverProcess.pid} /T /F`, (err, stdout, stderr) => {
                if (err) {
                    console.error(`Taskkill failed: ${err.message}`);
                    console.error(`Stderr: ${stderr}`);

                    // Fallback: try to kill using wmic
                    exec(`wmic process where processid=${serverProcess.pid} delete`, (wmicErr) => {
                        if (wmicErr) {
                            console.error(`WMIC kill also failed: ${wmicErr.message}`);
                            // Last resort: use Node.js kill
                            try {
                                process.kill(serverProcess.pid, 'SIGKILL');
                                console.log("Used Node.js process.kill as last resort.");
                            } catch (killErr) {
                                console.error(`All kill attempts failed: ${killErr.message}`);
                            }
                        } else {
                            console.log("Print service terminated using WMIC.");
                        }
                        resolve();
                    });
                } else {
                    console.log(`Print service terminated using taskkill. Output: ${stdout}`);
                    resolve();
                }
            });

            // Set a timeout to ensure we don't hang indefinitely
            setTimeout(() => {
                if (!serverProcess.killed) {
                    console.log("Forcing process termination after timeout.");
                    try {
                        serverProcess.kill('SIGKILL');
                    } catch (err) {
                        console.error(`Force kill failed: ${err.message}`);
                    }
                }
                resolve();
            }, 5000); // 5 second timeout

        } else {
            // Unix-like systems
            serverProcess.kill('SIGTERM');
            setTimeout(() => {
                if (!serverProcess.killed) {
                    serverProcess.kill('SIGKILL');
                }
                resolve();
            }, 3000);
        }

        // Mark process as killed to prevent multiple attempts
        serverProcess.killed = true;
    });
};


app.whenReady().then(() => {
    startPrintService();
    createWindow();
})



let isQuitting = false;

app.on('before-quit', async (event) => {
    if (isQuitting) return; // Prevent recursive calls

    event.preventDefault(); // Prevent immediate quit
    isQuitting = true;

    console.log('App is about to quit, stopping print service...');
    await stopPrintService();
    console.log('Print service stopped, quitting app...');

    // Force quit without triggering events again
    process.exit(0);
});

app.on('window-all-closed', async () => {
    console.log('All windows closed, stopping print service...');
    await stopPrintService();
    if (process.platform !== 'darwin') {
        console.log('Quitting app after service cleanup...');
        app.quit();
    }
});

// Handle force quit scenarios
process.on('SIGINT', async () => {
    console.log('Received SIGINT, stopping print service...');
    await stopPrintService();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, stopping print service...');
    await stopPrintService();
    process.exit(0);
});
ipcMain.handle('get-print-port', () => {
    return dynamicPort;
});

// Handle loading POS URL from startup screen
ipcMain.handle('load-pos-url', async (event, url) => {
    try {
        console.log('Loading POS URL:', url);
        
        // Load the POS URL in the main window
        await mainWindow.loadURL(url);
        
        console.log('POS URL loaded successfully');
        return { success: true };
    } catch (error) {
        console.error('Failed to load POS URL:', error);
        throw error;
    }
});

