import { app, autoUpdater, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, Notification, Tray } from 'electron';
import WAWebJS, { Client } from 'wwebjs-electron';
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
let whatsAppReady = false
let mainWindow: BrowserWindow
let wwebWindow: BrowserWindow
let reloadTimeout = 1000

const lostMessages: { contact: string, message: string }[] = []
const appIconPath = nativeImage.createFromPath(resolve(__dirname, 'images/app_icon_fill.png'))
const closeIconPath = nativeImage.createFromPath(resolve(__dirname, 'images/close_icon.png')).resize({ width: 16, height: 16 })

pie.initialize(app)
  .then(() => {
    const createMainWindow = async (): Promise<BrowserWindow> => {
      // Create the browser window.
      const mainWindow = new BrowserWindow({
        height: 512,
        width: 512,
        webPreferences: {
          preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
          nodeIntegration: true,
        },
        icon: resolve(__dirname, 'app_icon.png')
      });
      // and load the index.html of the app.
      mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
      mainWindow.webContents.send('getTimeout')
      return mainWindow
    };
    const createWWebWindow = async (): Promise<{ browser: Browser, window: BrowserWindow }> => {
      const window = new BrowserWindow({
        show: false
      })
      window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const browser = await pie.connect(app, puppeteer);
      return { browser, window }
    }

    const checkNinthDigit = async (contact: string): Promise<string> => {
      try {
        let contactId: WAWebJS.ContactId
        if (contact.startsWith('55') && contact.length === 13 && contact[4] === '9') {
          contactId = await whatsappClient.getNumberId(contact.slice(0, 4) + contact.slice(5))
        }

        if (!contactId) {
          contactId = await whatsappClient.getNumberId(contact)
        }

        if (contactId) {
          contact = contactId._serialized
          return contact
        } else {
          throw new Error('Contato inválido!')
        }
      } catch (error) {
        console.error(error);
        throw error
      }
    }
    const main = async () => {
      let needRefresh = true

      try {
        mainWindow = await createMainWindow()

        mainWindow.once('ready-to-show', async () => {
          console.log('MAIN WINDOW READY');
          const { browser, window } = await createWWebWindow()
          wwebWindow = window

          if (process.platform === 'win32') {
            const tray = new Tray(appIconPath.resize({ width: 16, height: 16 }))
            tray.on('click', () => {
              mainWindow.show()
            })
            const contextMenu = Menu.buildFromTemplate([
              {
                label: 'Sair', icon: closeIconPath, click: () => {
                  mainWindow.removeAllListeners()
                  app.quit()
                }
              }
            ])
            tray.setToolTip('WM Status App')
            const ballon = {
              title: 'Segundo Plano',
              content: 'Rodando em segundo plano',
              icon: appIconPath.resize({ width: 16, height: 16 })
            }
            tray.setContextMenu(contextMenu)
            mainWindow.on('close', (e) => {
              e.preventDefault()
              mainWindow.hide()
            })
            mainWindow.on('minimize', (e: Electron.Event) => {
              e.preventDefault()
              mainWindow.hide()
            })
            mainWindow.once('hide', () => {
              tray.displayBalloon(ballon)
            })
          } else {
            mainWindow.on('close', () => {
              wwebWindow.close()
            })
          }

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          whatsappClient = new Client(browser, wwebWindow);

          whatsappClient.pupBrowser.on('targetchanged', async () => {
            if (whatsappClient.pupPage) {
              needRefresh = await whatsappClient.pupPage.evaluate(() => {
                const body = document.querySelector('body')
                if (body.classList.value.includes('version')) {
                  return true
                } else {
                  return false
                }
              })

              if (needRefresh) {
                setTimeout(() => {
                  wwebWindow.webContents.reloadIgnoringCache()
                }, reloadTimeout);
              }
            }
          })


          whatsappClient.on('qr', (qr: string) => {
            needRefresh = false
            console.log('QR Code carregado')
            mainWindow.webContents.send('onqrcode', qr)
          });

          whatsappClient.on('ready', async () => {
            needRefresh = false
            whatsAppReady = true
            console.log('Client is ready!');
            if (!mainWindow.isFocused()) {
              new Notification({
                title: 'WM Status',
                body: 'WhatsApp conectado!'
              }).show()
            }
            while (lostMessages.length) {
              await whatsappClient.sendMessage(`${lostMessages[0].contact}@c.us`, lostMessages[0].message)
              lostMessages.shift()
            }
            mainWindow.webContents.send('onconnected', true)
          });

          whatsappClient.on('disconnected', () => {
            console.log('Client is disconnected!');
            new Notification({
              title: 'WM Status',
              body: 'WhatsApp desconectado!'
            }).show()
            mainWindow.webContents.send('ondisconnected', true)
          });

          whatsappClient.on('loading_screen', (percent, message) => {
            needRefresh = false
            console.log(percent, message);
            mainWindow.webContents.send('onloading', { percent, message })
          })

          whatsappClient.on('auth_failure', (message) => {
            mainWindow.webContents.send('error', message)
          })

          try {
            await whatsappClient.initialize();
          } catch (error) {
            console.error('AQUI ===>', error);
          }
        })
      } catch (error) {
        mainWindow.webContents.send('error', error)
        console.error(error);
        throw error
      }
      globalShortcut.register('F12', () => {
        mainWindow.webContents.toggleDevTools()
      })

      ipcMain.on('show-whatsapp', (_, show) => {
        if (show) {
          wwebWindow.show()
        } else {
          wwebWindow.hide()
        }
      })

      ipcMain.on('change-qr-color', (_, color) => {
        mainWindow.webContents.send('onChangeQrCodeColor', color)
      })

      ipcMain.on('reload-timeout', (_, timeout: number) => {
        reloadTimeout = timeout
      })
    }

    if (isDev && process.platform === 'win32') {
      // Set the path of electron.exe and your app.
      // These two additional parameters are only available on windows.
      // Setting this is required to get this working in dev mode.
      app.setAsDefaultProtocolClient('wmstatus-dev', process.execPath, [resolve(process.argv[1]), '']);
    } else {
      app.setAsDefaultProtocolClient('wmstatus');
    }

    const gotTheLock = app.requestSingleInstanceLock()

    if (!gotTheLock) {
      app.quit()
    } else {
      app.on('second-instance', async (event, commandLine) => {
        // Someone tried to run a second instance, we should focus our window.
        // eslint-disable-next-line prefer-const
        let { contact, message } = decodeMessage(commandLine[commandLine.length - 1])
        mainWindow.webContents.send('log', 'SECONDE INSTANCE')
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          try {
            if (whatsAppReady) {
              mainWindow.webContents.send('log', whatsAppReady)
              contact = await checkNinthDigit(contact)
              mainWindow.webContents.send('warn', 'ANTES DE ENVIAR MENSAGEM')
              const sendMessageReturn = await whatsappClient.sendMessage(contact, message)
              mainWindow.webContents.send('warn', sendMessageReturn)
            } else {
              mainWindow.webContents.send('warn', 'LOSTMESSAGES')
              lostMessages.push({ contact, message })
            }
          } catch (error) {
            mainWindow.webContents.send('error', error)
            dialog.showErrorBox('Ops!', error)
          }
        } else {
          mainWindow.webContents.send('error', 'MAIN WINDOW NOT FOUND')
        }
        // the commandLine is array of strings in which last element is deep link url
        // the url str ends with /
      })

      app.on('open-url', async (event, url) => {
        // eslint-disable-next-line prefer-const
        let { contact, message } = decodeMessage(url)
        if (mainWindow) {
          try {
            if (whatsAppReady) {
              contact = await checkNinthDigit(contact)
              await whatsappClient.sendMessage(`${contact}@c.us`, message)
            } else {
              lostMessages.push({ contact, message })
            }
          } catch (error) {
            dialog.showErrorBox('Ops!', error)
          }
        } else {
          lostMessages.push({ contact, message })
        }
      });

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
    }

    // Auto update

    const server = 'https://wm-status-update.vercel.app'
    const url = `${server}/update/${process.platform}/${app.getVersion()}`

    autoUpdater.setFeedURL({ url })

    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      const dialogOpts = {
        type: 'info',
        buttons: ['Reiniciar e atualizar', 'Mais tarde'],
        title: 'Atualização disponível!',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail:
          'Uma nova versão foi baixada. Reinicie o aplicativo para aplicar as atualizações.',
      }

      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        mainWindow.removeAllListeners()
        if (returnValue.response === 0) autoUpdater.quitAndInstall()
      })
    })

    autoUpdater.on('checking-for-update', () => {
      mainWindow.webContents.send('warn', 'Bucando por novas atualizações...')
    })

    autoUpdater.on('update-available', () => {
      mainWindow.webContents.send('warn', 'Nova atualização disponível, baixando...')
    })

    autoUpdater.on('error', (message) => {
      mainWindow.webContents.send('error', message)
      console.error('There was a problem updating the application')
      console.error(message)
    })

    setInterval(() => {
      autoUpdater.checkForUpdates()
    }, 1000 * 60)

  })
  .catch(err => console.error(err))
