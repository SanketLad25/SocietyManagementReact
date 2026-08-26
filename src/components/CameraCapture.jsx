import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import '../styles/cameraCapture.css'

// Live in-app photo capture via getUserMedia — a video preview, a Capture button that grabs the
// current frame to a canvas, then a Retake/Use Photo confirm step. Requires a secure context
// (HTTPS or localhost); on any getUserMedia failure (permission denied, no camera, insecure
// context) this shows a plain error and lets the caller fall back to the existing file-upload
// input rather than getting stuck.
function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
      return 'Camera permission was denied. Allow camera access for this site in your browser settings, or use "Upload File" instead.'
    case 'NotFoundError':
      return 'No camera was found on this device. Use "Upload File" instead.'
    case 'NotReadableError':
      return 'The camera is already in use by another application (e.g. a video call). Close it and try again, or use "Upload File" instead.'
    case 'SecurityError':
      return 'Camera access requires a secure connection (HTTPS or localhost). Use "Upload File" instead.'
    default:
      return `Could not access the camera${err?.name ? ` (${err.name})` : ''}. Use "Upload File" instead.`
  }
}

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access isn’t available in this browser.')
        return
      }

      // "environment" (rear camera) is only a preference, not a requirement — most laptop
      // webcams are front-only and have no "environment" camera at all. Some browsers throw
      // OverconstrainedError for that instead of quietly falling back, so retry with a plain,
      // unconstrained request (whatever camera exists) before giving up.
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } catch (err) {
          if (!cancelled) {
            setError(describeCameraError(err))
          }
          return
        }
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    }

    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
      },
      'image/jpeg',
      0.9,
    )
  }

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setCapturedBlob(null)
  }

  const handleUsePhoto = () => {
    if (!capturedBlob) return
    const file = new File([capturedBlob], `visitor-photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
    onCapture(file)
  }

  return (
    <Modal title="Take visitor photo" onClose={onClose}>
      <div className="camera-capture">
        {error ? (
          <p className="field-error">{error}</p>
        ) : capturedBlob ? (
          <img className="camera-capture-preview" src={previewUrl} alt="Captured visitor" />
        ) : (
          <video className="camera-capture-video" ref={videoRef} autoPlay playsInline muted />
        )}

        <div className="camera-capture-actions">
          {error ? (
            <button type="button" className="table-secondary-btn" onClick={onClose}>
              Close
            </button>
          ) : capturedBlob ? (
            <>
              <button type="button" className="table-secondary-btn" onClick={handleRetake}>
                Retake
              </button>
              <button type="button" className="auth-submit" onClick={handleUsePhoto}>
                Use Photo
              </button>
            </>
          ) : (
            <button type="button" className="auth-submit" onClick={handleCapture}>
              Capture
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
