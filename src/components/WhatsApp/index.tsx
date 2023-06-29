import { QRCodeCanvas } from "qrcode.react";
import React from "react";

interface WhatsAppProps {
  qrcode: string
  fgColorQr: string
  ready: boolean
  loading: {
    status: boolean;
    message: string | null;
    percent: number;
  }
  disconnected: boolean
}

export const WhatsApp = ({ qrcode, fgColorQr, ready, loading, disconnected }: WhatsAppProps) => {
  console.log(fgColorQr);
  return (
    <div className="h-screen bg-zinc-50 text-center flex flex-col justify-center items-center gap-4">
      {
        !ready ? (
          <>
            {loading.status ? (
              <>
                <h1 className="text-lg font-bold text-green-600">{loading.message ?? 'Carregando'}</h1>
                <div className="animate-spin rounded-full border-4 border-t-emerald-500  w-10 h-10 " ></div>
                <progress className="border border-emerald-600 rounded h-2 " max={100} value={loading.percent}></progress>
              </>
            ) :
              null
            }
            {qrcode && !loading.status ? (
              <>
                {
                  !disconnected ? (
                    <>
                      <h1 className="text-lg font-bold text-green-600">
                        Escaneie o QRCODE abaixo pelo aplicativo do WhatsApp com o seu celular!
                      </h1>
                      <QRCodeCanvas
                        value={qrcode}
                        size={256}
                        fgColor={fgColorQr}
                      />
                    </>
                  ) : null
                }
              </>
            ) :
              null
            }
            {
              disconnected ? (
                <h1 className="text-2xl text-green-500">Dispositivo Desconectado!</h1>
              ) : null
            }

          </>
        ) : (
          <h1 className="text-2xl text-green-500">Conectado com sucesso você já pode minimizar essa janela!</h1>
        )
      }

    </div >
  );
}
