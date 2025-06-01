import axios from "axios";

export const elevenLabs = axios.create({
    baseURL: 'https://api.elevenlabs.io/v1/convai',
    headers: {
        'Content-Type': 'application/json',
        'Xi-Api-Key': process.env.ELEVENLABS_API_KEY!
    }
});