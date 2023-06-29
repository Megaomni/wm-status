/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import React, { useEffect, useState } from 'react';
import './index.css';
import { WhatsAppApi } from './preload';

import { createRoot } from 'react-dom/client';
import { WhatsApp } from './components/WhatsApp';
import colors from 'tailwindcss/colors';

const domNode = document.getElementById('root');
export const root = createRoot(domNode);

interface ElectronWindow extends Window {
  WhatsApp: typeof WhatsAppApi
}

declare const window: ElectronWindow

const App = () => {
  const [qrcode, setQrcode] = useState('')
  const [ready, setReady] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  const [loading, setLoading] = useState({ status: true, message: null, percent: 0 })
  const [fgColorQr, setFgColorQr] = useState<string>(localStorage.getItem('qrFgColor') || (colors.emerald['500'] || "#10b981"))

  useEffect(() => {
    window.WhatsApp.onqrcode((_, qr: string) => {
      setLoading(state => ({ ...state, status: false }))
      setQrcode(qr)
    })

    window.WhatsApp.onChangeQrCodeColor((_, color) => {
      setFgColorQr(color)
    })

    window.WhatsApp.ondisconnected(() => {
      setReady(false)
      setDisconnected(true)
      console.log('Disconectado');
    })

    window.WhatsApp.onconnected(() => {
      setReady(true)
      setLoading(state => ({ ...state, status: false }))
      console.log('Conectado');
    })

    window.WhatsApp.onloading((event, { message, percent }) => {
      setLoading(() => ({ status: true, message, percent }))
      console.log(message);
    })
  }, [])

  return (
    <>
      <WhatsApp qrcode={qrcode} fgColorQr={fgColorQr} ready={ready} loading={loading} disconnected={disconnected} />
    </>
  );
}

root.render(<App />)