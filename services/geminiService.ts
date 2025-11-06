import {
  GoogleGenAI,
  Modality,
  GenerateContentResponse,
  FunctionDeclaration,
  Type,
  LiveServerMessage,
  Blob,
  Chat
} from "@google/genai";
import {
  GEMINI_FLASH_MODEL,
  GEMINI_FLASH_IMAGE_MODEL,
  GEMINI_PRO_MODEL,
  GEMINI_LIVE_MODEL,
  IMAGEN_MODEL,
  SYSTEM_INSTRUCTION_RECIPE_GEN,
  SYSTEM_INSTRUCTION_CHEF_FRIDGE
} from '../constants';
import { Ingredient, Recipe, ChatMessage } from '../types';

// Utility functions for audio encoding/decoding, as per Gemini Live API guidance.
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels; // Fixed typo here
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createAudioBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

class GeminiService {
  // Centralized way to get a GoogleGenAI instance, ensuring API_KEY is used.
  private getGoogleGenAIInstance(): GoogleGenAI {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not set. Please ensure it's available in the environment.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async analyzeImage(
    base64Image: string,
    mimeType: string,
  ): Promise<{ ingredients: Ingredient[]; rawAnalysis: string }> {
    const ai = this.getGoogleGenAIInstance();
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Image,
      },
    };
    const textPart = {
      text: `Analyze the uploaded image. Identify all distinct food items, estimate their quantity (e.g., '2 large', '1 bag', '500g'), and note their general freshness (e.g., 'fresh', 'good', 'expiring', 'spoiled').
            Provide the output as a JSON array of objects with 'name', 'quantity', and 'freshness' properties.
            Example: [{"name": "apple", "quantity": "2 large", "freshness": "fresh"}, {"name": "milk", "quantity": "1 liter", "freshness": "good"}]
            Also, provide a raw analysis string before the JSON.`,
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.STRING },
              freshness: { type: Type.STRING },
            },
            required: ['name', 'quantity', 'freshness'],
          },
        },
      },
    });

    const jsonStr = response.text.trim();
    console.log("Image analysis raw response:", jsonStr);

    try {
      const ingredients: Ingredient[] = JSON.parse(jsonStr);
      return { ingredients, rawAnalysis: `Identified ${ingredients.length} items.` };
    } catch (e) {
      console.error("Failed to parse image analysis response as JSON:", e);
      const fallbackPrompt = `Identify food items and their quantities from the image. List them in a human-readable format.`;
      const fallbackResponse = await ai.models.generateContent({
        model: GEMINI_FLASH_MODEL,
        contents: { parts: [imagePart, { text: fallbackPrompt }] },
      });
      return { ingredients: [], rawAnalysis: fallbackResponse.text };
    }
  }

  async generateRecipes(
    ingredients: Ingredient[],
    dietaryPreferences: string,
  ): Promise<Recipe[]> {
    const ai = this.getGoogleGenAIInstance();
    const ingredientsList = ingredients
      .map((i) => `${i.quantity} ${i.name} (${i.freshness})`)
      .join(', ');

    const prompt = `Based only on these detected ingredients: [${ingredientsList}], and considering the user's known dietary preferences: "${dietaryPreferences || 'none'}", generate three distinct recipe options. For each recipe, provide a brief, engaging summary and immediately flag a key health insight. The response should be a JSON array of recipe objects, each with 'name', 'summary', 'healthInsight', and 'ingredients' (as a string array).`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_PRO_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_RECIPE_GEN,
        thinkingConfig: { thinkingBudget: 32768 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              summary: { type: Type.STRING },
              healthInsight: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['name', 'summary', 'healthInsight', 'ingredients'],
          },
        },
      },
    });

    const jsonStr = response.text.trim();
    try {
      const recipes: Recipe[] = JSON.parse(jsonStr);
      return recipes;
    } catch (e) {
      console.error("Failed to parse recipe generation response as JSON:", e);
      throw new Error("Could not generate recipes in the expected format.");
    }
  }

  // New method to create a Chat session
  createChatSession(): Chat {
    const ai = this.getGoogleGenAIInstance();
    return ai.chats.create({
      model: GEMINI_FLASH_MODEL,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_CHEF_FRIDGE,
      },
    });
  }

  async getGroundedResponse(
    prompt: string,
  ): Promise<{ text: string; sources: { uri: string; title?: string }[] }> {
    const ai = this.getGoogleGenAIInstance();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: SYSTEM_INSTRUCTION_CHEF_FRIDGE,
      },
    });

    const text = response.text;
    const sources: { uri: string; title?: string }[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      for (const chunk of response.candidates[0].groundingMetadata
        .groundingChunks) {
        if (chunk.web) {
          sources.push({ uri: chunk.web.uri, title: chunk.web.title });
        } else if (chunk.maps) {
          sources.push({ uri: chunk.maps.uri, title: chunk.maps.title });
          // Add review snippets if available
          if (chunk.maps.placeAnswerSources && chunk.maps.placeAnswerSources.reviewSnippets) {
            chunk.maps.placeAnswerSources.reviewSnippets.forEach(snippet => {
              // FIX: Cast snippet to a more specific type to correctly access 'uri' and 'reviewText'
              // if the current @google/genai type definitions are causing errors,
              // while ensuring runtime safety.
              const typedSnippet = snippet as { uri?: string; reviewText?: string };
              if (typedSnippet.uri) {
                sources.push({ uri: typedSnippet.uri, title: `Review: ${typedSnippet.reviewText || typedSnippet.uri}` });
              }
            });
          }
        }
      }
    }
    return { text, sources };
  }

  async generateImage(prompt: string): Promise<string> {
    const ai = this.getGoogleGenAIInstance();
    const response = await ai.models.generateImages({
      model: IMAGEN_MODEL,
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    const base64ImageBytes: string | undefined =
      response.generatedImages[0]?.image.imageBytes;
    if (!base64ImageBytes) {
      throw new Error('No image bytes received from Imagen API.');
    }
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  }

  async connectLiveSession(params: {
    onOpen: () => void;
    onMessage: (message: LiveServerMessage) => void;
    onError: (e: ErrorEvent) => void;
    onClose: (e: CloseEvent) => void;
    inputAudioContext: AudioContext;
    outputAudioContext: AudioContext;
  }) {
    const ai = this.getGoogleGenAIInstance();

    const controlLightFunctionDeclaration: FunctionDeclaration = {
      name: 'controlLight',
      parameters: {
        type: Type.OBJECT,
        description: 'Set the brightness and color temperature of a room light.',
        properties: {
          brightness: {
            type: Type.NUMBER,
            description:
              'Light level from 0 to 100. Zero is off and 100 is full brightness.',
          },
          colorTemperature: {
            type: Type.STRING,
            description:
              'Color temperature of the light fixture such as `daylight`, `cool` or `warm`.',
          },
        },
        required: ['brightness', 'colorTemperature'],
      },
    };

    return ai.live.connect({
      model: GEMINI_LIVE_MODEL,
      callbacks: {
        onopen: params.onOpen,
        // Fix: Changed 'onError' to 'onerror' to match the expected LiveCallbacks type.
        onmessage: params.onMessage,
        onerror: params.onError,
        onclose: params.onClose,
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: SYSTEM_INSTRUCTION_CHEF_FRIDGE,
        outputAudioTranscription: {}, // Enable transcription for model output audio.
        inputAudioTranscription: {}, // Enable transcription for user input audio.
        tools: [{ functionDeclarations: [controlLightFunctionDeclaration] }], // Example function
      },
    });
  }

  createAudioBlob = createAudioBlob;
  decodeAudioData = decodeAudioData;
  decode = decode; // Expose decode function
}

const geminiService = new GeminiService();
export default geminiService;