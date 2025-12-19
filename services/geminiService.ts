
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { VoiceName } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const translateText = async (text: string, sourceLang: string, targetLang: string): Promise<string> => {
  if (sourceLang === targetLang) return text;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Translate the following text from ${sourceLang} to ${targetLang}. Only return the translated text without any explanations or extra characters: "${text}"`,
    config: {
      temperature: 0.3,
    }
  });

  return response.text || '';
};

export const generateSpeech = async (text: string, voiceName: VoiceName): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned");
  return base64Audio;
};
