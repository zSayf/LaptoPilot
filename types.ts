import type { Chat } from '@google/genai';

export type { Chat };

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  functionCall?: {
      name: string;
      args: any;
  };
}

export interface LaptopSpec {
  cpu: string;
  gpu: string;
  ram: string;
  storage: string;
  display: string;
  operatingSystem: string;
  webcam: string;
  keyboard: string;
  ports: string;
}

export interface Laptop {
  modelName: string;
  price: number;
  currency: string;
  retailer: string;
  retailerUrl: string;
  specs: LaptopSpec;
  justification: string;
  imageUrl?: string;
  bestFeature?: string;
}

export type AppState = 'welcome' | 'chatting' | 'loading' | 'results' | 'apiKeySetup' | 'modelSelect';

/** Capability tier of a Gemini model, derived from its id. */
export type ModelTier = 'pro' | 'flash' | 'flash-lite' | 'standard';

/** A model that can power this app, as returned by listCompatibleModels. */
export interface CompatibleModel {
    /** Bare model id, e.g. "gemini-3.8-flash" (no "models/" prefix). */
    id: string;
    displayName: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    tier: ModelTier;
    /** Numeric version parsed out of the id, used for newest-first sorting. */
    version: number;
}


export interface GroundingSource {
    uri: string;
    title: string;
}

export interface RecommendationArgs {
    country: string;
    budget: number;
    currency: string;
    primaryUse: string;
    secondaryUse?: string;
    specificNeeds: string;
}

export interface Country {
    name: string;
    code: string;
    currency: string;
    budgetMin: number;
    budgetMax: number;
    budgetStep: number;
}