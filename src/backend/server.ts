import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { Configuration, OpenAIApi } from 'openai'
import multer from 'multer'
import fs from 'fs'
import { AxiosError } from 'axios'


const app = express()
app.use(express.static('./dist/public'))
app.use(express.json())
app.use(cors())

async function audioTranslation(filePath: string) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
  const openai = new OpenAIApi(configuration)
  try {
    // transcribe from audio
    const response = await openai.createTranscription(
      fs.createReadStream(filePath) as unknown as File, // The audio file to transcribe.
      'whisper-1', // The model to use for transcription.
      undefined, // The prompt to use for transcription.
      'json', // The format of the transcription.
      1, // Temperature
      // src // Language
    )
    const prompt = response.data.text

    const result = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `Next message is in English or Japanese.\nPlease translate it into the opposite language and return follow format strictly.\n${prompt}`,
      temperature: 0.3,
      max_tokens: 100,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    })
    return result.data.choices[0].text
  } catch (err) {
    if (err instanceof AxiosError && err?.response) {
      console.log(err.response.data)
    }
    return null
  }
}
async function translate(req: Request, res: Response) {
  if (!req.files || req.files.length === 0) return res.json({ message: 'empty file' })
  const audio_file = (req.files as Express.Multer.File[])[0]
  const pathWithExt = audio_file.path + '.wav'
  await fs.promises.rename(audio_file.path, pathWithExt)

  const result = await audioTranslation(pathWithExt)
  return res.json({
    transcription: result,
    audioFileName: audio_file.filename,
  })
}

const upload = multer({ dest: './dist/uploads/' })
const router = express.Router()

const wrap = (callback: (req: Request, res: Response) => void) => async (req: Request, res: Response) => {
  try {
    return await callback(req, res)
  } catch (err) {
    console.log(err)
  }
}

router.post('/', upload.any(), wrap(translate))
app.use('/api', router)


app.listen(process.env.PORT || 3000, function () {
  console.log('Ready to Go!')
})

