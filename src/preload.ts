// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron'

export const WhatsAppApi = {
  onqrcode: (callback: (event: Electron.IpcRendererEvent, qrcode: string) => void) => ipcRenderer.on('onqrcode', callback),
  onconnected: (callback: (event: Electron.IpcRendererEvent, value: boolean) => void) => ipcRenderer.on('onconnected', callback),
  ondisconnected: (callback: (event: Electron.IpcRendererEvent, value: boolean) => void) => ipcRenderer.on('ondisconnected', callback),
  onloading: (callback: (event: Electron.IpcRendererEvent, value: { percent: number, message: string }) => void) => ipcRenderer.on('onloading', callback),
  onChangeQrCodeColor: (callback: (event: Electron.IpcRendererEvent, color: string) => void) => ipcRenderer.on('onChangeQrCodeColor', callback),
  /** Muda a cor dos pontos do qrcode */
  changeFgQrColor: (color: string) => {
    localStorage.setItem('qrFgColor', color)
    return ipcRenderer.send('change-qr-color', color)
  },
  /** Mostra/Esconde a tela do whatsapp web */
  showWhatsapp: (show: boolean) => ipcRenderer.send('show-whatsapp', show),
  /** Tempo de espera para recarregar página de versão do whatsapp em segundos */
  setReloadWhenVersionPageTimeOut: (timeout: number) => {
    localStorage.setItem('reloadTimout', (timeout * 1000).toString())
  }
}

contextBridge.exposeInMainWorld('WhatsApp', WhatsAppApi)

ipcRenderer.on('getTimeout', () => {
  ipcRenderer.send('reload-timeout', localStorage.getItem('reloadTimout') ? Number(localStorage.getItem('reloadTimout')) : 1000)
})

ipcRenderer.on('log', (event, log) => {
  console.log(log);
})

ipcRenderer.on('error', (event, error) => {
  console.error(error);
})

ipcRenderer.on('warn', (event, warn) => {
  console.warn(warn);
})