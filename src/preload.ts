// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron'

export const WhatsAppApi = {
  onqrcode: (callback: (event: Electron.IpcRendererEvent, qrcode: string) => void) => ipcRenderer.on('onqrcode', callback),
  onconnected: (callback: (event: Electron.IpcRendererEvent, value: boolean) => void) => ipcRenderer.on('onconnected', callback),
  ondisconnected: (callback: (event: Electron.IpcRendererEvent, value: boolean) => void) => ipcRenderer.on('ondisconnected', callback),
  onloading: (callback: (event: Electron.IpcRendererEvent, value: { percent: number, message: string }) => void) => ipcRenderer.on('onloading', callback),
}

contextBridge.exposeInMainWorld('WhatsApp', WhatsAppApi)

ipcRenderer.on('log', (event, log) => {
  console.log(log);
})

ipcRenderer.on('error', (event, error) => {
  console.error(error);
})

ipcRenderer.on('warn', (event, warn) => {
  console.warn(warn);
})