// utils/transcribeVoice.ts
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY!,
});

export async function transcribeVoice(audioUrl: string): Promise<string> {
    // 1. Download the audio
    const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(response.data);

    // 2. Save it to a temp file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `${uuidv4()}.ogg`);
    await fs.writeFile(tempFilePath, audioBuffer);

    // 3. Upload to Gemini
    const uploadedFile = await ai.files.upload({
        file: tempFilePath,
        config: { mimeType: 'audio/ogg' }, // change if needed
    });

    // 4. Create part from uploaded URI and transcribe
    if (!uploadedFile.uri || !uploadedFile.mimeType) {
        throw new Error('Failed to upload audio file or missing URI/mimeType.');
    }
    const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: createUserContent([
            createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
            'Transcribe this audio message clearly. Return only the spoken text.',
        ]),
    });

    // 5. Optional: delete temp file
    await fs.unlink(tempFilePath);

    return result.text ?? '';
}