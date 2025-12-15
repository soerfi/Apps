import { useState } from 'react'

function App() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle, uploading, processing, complete
  const [taskId, setTaskId] = useState(null)
  const [result, setResult] = useState(null)

  const [selectedPreset, setSelectedPreset] = useState('ghost_mannequin')

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  const handleUploadAndProcess = async () => {
    if (!file) return
    setStatus('uploading')

    try {
      // 1. Upload
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch(`${import.meta.env.VITE_API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()

      // 2. Process
      setStatus('processing')
      const processRes = await fetch(`${import.meta.env.VITE_API_URL}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: uploadData.filename,
          preset: selectedPreset
        })
      })
      const processData = await processRes.json()
      setTaskId(processData.task_id)

      // 3. Poll Status
      pollStatus(processData.task_id)

    } catch (error) {
      console.error(error)
      setStatus('error')
    }
  }

  const pollStatus = (id) => {
    const interval = setInterval(async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/status/${id}`)
      const data = await res.json()

      if (data.state === 'SUCCESS') {
        console.log('Poll Success Data:', data) // Debug log
        clearInterval(interval)
        setStatus('complete')
        setResult(data.result)
      } else if (data.state === 'FAILURE') {
        clearInterval(interval)
        setStatus('error')
      } else {
        // Still pending/progress
        console.log(data.status)
      }
    }, 1000)
  }


  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Transform Your</span>
            <span className="block text-primary">Product Photos</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            AI-powered enhancement with Color Guardian™ technology.
          </p>
        </div>

        <div className="mt-10 bg-white shadow sm:rounded-lg p-6">
          <div className="space-y-6">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary transition-colors cursor-pointer"
            >
              <div className="space-y-1 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm text-gray-600 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Upload a file</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
              </div>
            </div>

            {file && (
              <p className="text-sm text-gray-500 text-center font-medium bg-gray-100 py-2 rounded">
                Selected: {file.name}
              </p>
            )}


            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Select Enhancement Mode</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { id: 'ghost_mannequin', title: 'Ghost Mannequin', desc: '3D volume effect' },
                  { id: 'model_swap', title: 'Model Swap', desc: 'Lifestyle context' },
                  { id: 'outpaint', title: 'Batch & Resize', desc: 'Expand canvas' },
                ].map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`relative rounded-lg border p-4 cursor-pointer shadow-sm flex flex-col hover:border-primary transition-all ${selectedPreset === preset.id ? 'border-primary ring-2 ring-primary ring-opacity-50 bg-indigo-50' : 'border-gray-300'
                      }`}
                  >
                    <div className="flex flex-1 flex-col">
                      <span className="block text-sm font-medium text-gray-900">{preset.title}</span>
                      <span className="mt-1 flex text-sm text-gray-500">{preset.desc}</span>
                    </div>
                    {selectedPreset === preset.id && (
                      <div className="absolute top-2 right-2 text-primary">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleUploadAndProcess}
                disabled={!file || status === 'uploading' || status === 'processing'}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === 'idle' && 'Process Enhancement'}
                {status === 'uploading' && 'Uploading Image...'}
                {status === 'processing' && 'Enhancing with AI...'}
                {status === 'complete' && 'Processing Complete'}
                {status === 'error' && 'Error Occurred'}
              </button>
            </div>

            {status === 'complete' && result && (
              <div className="mt-6 border-t pt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Enhancement Result</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-700 mb-2">Metrics</h4>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                      <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Color Target</dt>
                        <dd className="mt-1 text-sm text-gray-900 flex items-center">
                          <span className="w-4 h-4 rounded-full mr-2 border border-gray-200" style={{ backgroundColor: result.color_metrics?.target }}></span>
                          {result.color_metrics?.target || 'N/A'}
                        </dd>
                      </div>
                      <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Delta E (Accuracy)</dt>
                        <dd className={`mt-1 text-sm font-bold ${result.color_metrics?.delta_e < 2.0 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {result.color_metrics?.delta_e?.toFixed(2) || 'N/A'}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Job ID</dt>
                        <dd className="mt-1 text-xs text-gray-400 break-all">{taskId}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-center">
                    {result.result_url ? (
                      <div className="text-center">
                        <a href={result.result_url} target="_blank" rel="noreferrer" className="text-primary hover:underline block mb-2">Open Image</a>
                        <img src={result.result_url} alt="Enhanced" className="max-h-48 rounded shadow-sm mx-auto" />
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">No image URL returned</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
