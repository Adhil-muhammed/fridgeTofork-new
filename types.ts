import { GenerateContentResponse } from "@google/genai";

export type TabName = 'scan' | 'chat' | 'inventory' | 'imageGen' | 'health' | 'recipes' | 'voicechat';

export interface Ingredient {
  name: string;
  quantity: string;
  freshness: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity?: string;
  checked: boolean;
}

export interface IngredientCategory {
  name: string;
  icon: string; // e.g., '🥦', '🥛', '🥩'
  items: Ingredient[];
}

export interface Recipe {
  name: string;
  summary: string;
  healthInsight: string;
  ingredients: string[];
  instructions: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  isStreaming?: boolean;
  timestamp: Date;
  sources?: { uri: string; title?: string }[];
  functionCalls?: GenerateContentResponse['functionCalls'];
}

export interface AudioBufferData {
  buffer: AudioBuffer;
  duration: number;
}