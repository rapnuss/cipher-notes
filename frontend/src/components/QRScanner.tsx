import {HTMLProps, useEffect, useRef} from 'react'
import QrScanner from 'qr-scanner'

export type QRScannerProps = HTMLProps<HTMLVideoElement> & {onScan: (text: string) => void}
export const QRScanner = ({onScan, ...props}: QRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    let qrScanner: QrScanner | null = null
    if (videoRef.current) {
      qrScanner = new QrScanner(videoRef.current, (res) => onScan(res.data), {})
      qrScanner.start()
    }
    return () => {
      if (qrScanner) {
        qrScanner.stop()
        qrScanner.destroy()
        qrScanner = null
      }
    }
  }, [onScan])
  return <video ref={videoRef} {...props} />
}
