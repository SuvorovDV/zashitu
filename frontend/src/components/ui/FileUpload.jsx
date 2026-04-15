import { useRef, useState } from 'react'
import { filesApi } from '../../api/index.js'
import Spinner from './Spinner.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function FileUpload({ orderId, onUploaded }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [uploaded, setUploaded] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function handleFile(selected) {
    if (!selected) return
    setFile(selected)
    setError(null)
    setUploaded(false)
    setUploading(true)
    try {
      const res = await filesApi.upload(orderId, selected)
      setUploaded(true)
      onUploaded?.(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Ошибка загрузки файла')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  function handleClear() {
    setFile(null)
    setUploaded(false)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-brand-500 bg-brand-500/10'
            : 'border-white/15 hover:border-white/30 bg-white/4'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-brand-400">
            <Spinner size="md" />
            <span className="text-xs">Загружаем...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Перетащите или нажмите для выбора</span>
            <span className="text-xs text-gray-600">PDF или DOCX · до 20 МБ</span>
          </div>
        )}
      </div>

      {file && !uploading && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
          uploaded
            ? 'bg-green-500/10 border border-green-500/20'
            : 'bg-white/4 border border-white/10'
        }`}>
          <div className="flex items-center gap-2 overflow-hidden">
            {uploaded && (
              <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="truncate text-gray-300 text-xs">{file.name}</span>
            <span className="text-gray-600 text-xs flex-shrink-0">({formatBytes(file.size)})</span>
          </div>
          <button onClick={handleClear} className="ml-2 text-gray-600 hover:text-red-400 flex-shrink-0 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
