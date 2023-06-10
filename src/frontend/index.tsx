import axios from 'axios'
import React from 'react'
import * as ReactDOMClient from 'react-dom/client'

const App: React.FC<{stream: MediaStream}> = (props) => {
  const audioContext = React.useRef<AudioContext>(new AudioContext())
  const mediaStreamSource = React.useRef<MediaStreamAudioSourceNode>(audioContext.current.createMediaStreamSource(props.stream))
  const bufferSize = 4096
  const recorder = React.useRef(audioContext.current.createScriptProcessor(bufferSize, 1, 1))
  const audioData = React.useRef<number[]>([])
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [recording, setRecording] = React.useState(false)
  const [lang, setLang] = React.useState('ja')
  const [translation, setTranslation] = React.useState('')

  // WAVエンコード処理
  const encodeWAV = (audioData: number[], sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + audioData.length * 2)
    const view = new DataView(buffer)

    // WAVヘッダーの設定
    writeString(view, 0, 'RIFF') // RIFFヘッダー
    setUint32(view, 4, 36 + audioData.length * 2, true) // ファイルサイズ
    writeString(view, 8, 'WAVE') // WAVEヘッダー
    writeString(view, 12, 'fmt ') // fmtチャンク
    setUint32(view, 16, 16, true) // fmtチャンクのサイズ
    setUint16(view, 20, 1, true) // フォーマットID (PCM)
    setUint16(view, 22, 1, true) // チャンネル数
    setUint32(view, 24, sampleRate, true) // サンプリングレート
    setUint32(view, 28, sampleRate * 2, true) // データ速度 (サンプリングレート * ブロックサイズ)
    setUint16(view, 32, 2, true) // ブロックサイズ (チャンネル数 * サンプルサイズ / 8)
    setUint16(view, 34, 16, true) // サンプルサイズ (ビット数)
    writeString(view, 36, 'data') // dataチャンク
    setUint32(view, 40, audioData.length * 2, true) // データサイズ

    // 音声データの書き込み
    
    const offset = 44
    for (let i = 0; i < audioData.length; i++) {
      writeSampleData(view, offset + i * 2, audioData[i])
    }

    return buffer
  }

  // DataViewに文字列を書き込むヘルパー関数
  function writeString(dataView: DataView, offset: number, value: string) {
    for (let i = 0; i < value.length; i++) {
      dataView.setUint8(offset + i, value.charCodeAt(i))
    }
  }
  // DataViewに2バイトの整数値を設定するヘルパー関数
  const setUint16 = (dataView: DataView, offset:number, value: number, littleEndian: boolean) => {
    dataView.setUint16(offset, value, littleEndian)
  }

  // DataViewに4バイトの整数値を設定するヘルパー関数
  const setUint32 = (dataView: DataView, offset:number, value: number, littleEndian: boolean) => {
    dataView.setUint32(offset, value, littleEndian)
  }

  // 音声データの書き込み
  const writeSampleData = (dataView: DataView, offset:number, sample: number) => {
    const sampleValue = Math.max(-1, Math.min(1, sample))
    const sampleInt = sampleValue < 0 ? sampleValue * 0x8000 : sampleValue * 0x7FFF
    dataView.setInt16(offset, sampleInt, true)
  }

  const record = () => {
    setRecording(!recording)
    if (recording) {
      recordEnd()
    } else {
      recordStart()
    }
  }

  const recordStart = () => {
    audioData.current = []
    recorder.current.onaudioprocess = function(event: { inputBuffer: { getChannelData: (channel: number) => Float32Array; }; }) {
      const channelData = event.inputBuffer.getChannelData(0)
      audioData.current.push(...channelData)
    }
  
    mediaStreamSource.current.connect(recorder.current)
    recorder.current.connect(audioContext.current.destination)
  }

  const recordEnd = () => {
    recorder.current.disconnect()
    mediaStreamSource.current.disconnect()

    const wavData = encodeWAV(audioData.current, audioContext.current.sampleRate)
    const audioBlob = new Blob([wavData], { type: 'audio/wav' })
    const audioURL = URL.createObjectURL(audioBlob)
    if(audioRef.current){
      audioRef.current.src = audioURL
      // audioRef.current.play();

      const formData = new FormData()
      formData.append('lang', lang)
      formData.append('record_file', audioBlob, 'audio.wav')
      axios.post('/api', formData)
        .then((response) => response.data)
        .then((data) => {
          if (data.transcription) {
            setTranslation(data.transcription)
            speech(data.transcription)
          }
        })
    }
  }

  const speech = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    speechSynthesis.speak(utterance)
  }

  return (
    <div>
      <h1>ほんやくコンニャク</h1>
      <div>
        <select onChange={(e) => setLang(e.target.value)} style={{display: 'block'}}>
          <option value="ja">日本語→English</option>
          <option value="en">English→日本語</option>
        </select>
        <button type="button" onClick={record}>{recording ? 'Stop' : 'Start'}</button>
      </div>
      <div>
        <audio controls id="audio" ref={audioRef}></audio>
        {translation && <p>{translation}</p>}
      </div>
    </div>
  )
}

const container = document.getElementById('root')

if(container) {
  // Create a root.
  const root = ReactDOMClient.createRoot(container)

  // Initial render: Render an element to the root.
  navigator.mediaDevices.getUserMedia({     
    audio: {
      sampleRate: 16000, // 16kHz（whisperは16kHzのみ対応）
      channelCount: 1, // モノラル
    } 
  }).then((stream) => {
    root.render(<App stream={stream} />)
  })
}
