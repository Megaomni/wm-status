import { app, BrowserWindow, dialog } from 'electron';
import { Client } from 'wwebjs-electron';
import pie from "puppeteer-in-electron";
import isDev from 'electron-is-dev'
import { decodeMessage } from './utils/decodeMessage';
import puppeteer, { Browser } from 'puppeteer-core';
import { resolve } from "path";
// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let whatsappClient: Client

pie.initialize(app)
  .then(() => {
    const createMainWindow = async (): Promise<BrowserWindow> => {
      // Create the browser window.
      const mainWindow = new BrowserWindow({
        height: 600,
        width: 800,
        webPreferences: {
          preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
          nodeIntegration: true
        },
      });

      // and load the index.html of the app.
      mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

      // Open the DevTools.
      mainWindow.webContents.openDevTools();
      return mainWindow
    };
    const createWWebWindow = async (mainWindow: BrowserWindow): Promise<{ browser: Browser, window: BrowserWindow }> => {
      const window = new BrowserWindow({
        width: 0,
        height: 0
      })
      window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

      mainWindow.on('ready-to-show', () => {
        window.on('ready-to-show', () => {
          setTimeout(() => {
            window.webContents.reloadIgnoringCache()
            window.hide()
            window.removeAllListeners('ready-to-show')
          }, 1000);
        })
      })
      mainWindow.on('close', () => {
        window.close()
      })

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const browser = await pie.connect(app, puppeteer);
      return { browser, window }
    }

    const main = async () => {
      let mainWindow: BrowserWindow
      let wwebWindow: BrowserWindow
      try {
        mainWindow = await createMainWindow()

        const { browser, window } = await createWWebWindow(mainWindow)
        wwebWindow = window

        const gotTheLock = app.requestSingleInstanceLock()

        if (!gotTheLock) {
          app.quit()
        } else {
          app.on('second-instance', (event, commandLine) => {
            // Someone tried to run a second instance, we should focus our window.
            const { contact, message } = decodeMessage(commandLine[commandLine.length - 1])

            if (mainWindow) {

              if (mainWindow.isMinimized()) mainWindow.restore()
              whatsappClient.sendMessage(`${contact}@c.us`, message)
            }
            // the commandLine is array of strings in which last element is deep link url
            // the url str ends with /
          })
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        whatsappClient = new Client(browser, wwebWindow);

        mainWindow.on('ready-to-show', () => {
          console.log('MAIN WINDOW READY');
          setTimeout(() => {
            window.webContents.reloadIgnoringCache()
            window.removeAllListeners('ready-to-show')
          }, 1000);
        })

        whatsappClient.on('qr', (qr: string) => {
          mainWindow.webContents.send('onqrcode', qr)
        });

        whatsappClient.on('ready', () => {
          console.log('Client is ready!');
          mainWindow.webContents.send('onconnected', true)

        });

        whatsappClient.on('disconnected', () => {
          console.log('Client is disconnected!');
          mainWindow.webContents.send('ondisconnected', true)
        });

        whatsappClient.on('loading_screen', () => {
          mainWindow.webContents.send('onloading', true)
        })

        whatsappClient.on('auth_failure', (message) => {
          mainWindow.webContents.send('error', message)
        })

        await whatsappClient.initialize();
      } catch (error) {
        mainWindow.webContents.send('error', error)
        dialog.showErrorBox('Client Initialize', error)
        console.error(error);
        throw error
      }

      if (isDev && process.platform === 'win32') {
        // Set the path of electron.exe and your app.
        // These two additional parameters are only available on windows.
        // Setting this is required to get this working in dev mode.
        app.setAsDefaultProtocolClient('wmstatus-dev', process.execPath, [resolve(process.argv[1]), 'teste']);
      } else {
        if (process.platform === 'darwin') {
          app.on('open-url', function (event, url) {
            const { contact, message } = decodeMessage(url)
            console.log(contact, message);
            whatsappClient.sendMessage(`${contact}@c.us`, message)
          });
        }
        app.setAsDefaultProtocolClient('wmstatus');
      }

    }
    app.on('ready', main);

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', async () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        await main();
      }
    });
  })
  .catch(err => console.error(err))
