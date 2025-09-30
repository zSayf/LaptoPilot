import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import type { Laptop, GroundingSource, RecommendationArgs } from '../types';

// Remove the environment variable check and initialization
// We'll create instances dynamically based on provided API keys

export const findLaptopRecommendationsTool: FunctionDeclaration = {
    name: 'findLaptopRecommendations',
    description: 'Finds the top 5 laptop recommendations based on user criteria.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            country: {
                type: Type.STRING,
                description: 'The country the user is in, e.g., "United States".'
            },
            budget: {
                type: Type.NUMBER,
                description: 'The user\'s budget.'
            },
            currency: {
                type: Type.STRING,
                description: 'The currency for the user\'s budget, e.g., "USD", "CAD", "EGP".'
            },
            primaryUse: {
                type: Type.STRING,
                description: 'The primary use case for the laptop, e.g., "Gaming", "Student", "Software Development".'
            },
            secondaryUse: {
                type: Type.STRING,
                description: 'A secondary use case for the laptop.'
            },
            specificNeeds: {
                type: Type.STRING,
                description: 'A summary of other specific needs like desired screen size, battery life, specific games or software to be used.'
            },
        },
        required: ['country', 'budget', 'currency', 'primaryUse', 'specificNeeds'],
    },
};

const laptopSpecSchema = {
    type: Type.OBJECT,
    properties: {
        cpu: { type: Type.STRING, description: "Processor model, e.g., 'Intel Core i7-13650HX'" },
        gpu: { type: Type.STRING, description: "Graphics card model, e.g., 'NVIDIA GeForce RTX 4060'" },
        ram: { type: Type.STRING, description: "Amount of RAM, e.g., '16GB DDR5'" },
        storage: { type: Type.STRING, description: "Storage capacity and type, e.g., '1TB NVMe SSD'" },
        display: { type: Type.STRING, description: "Display size and resolution, e.g., '16-inch QHD+ 165Hz'" },
        operatingSystem: { type: Type.STRING, description: "Operating system, e.g., 'Windows 11 Home'" },
        webcam: { type: Type.STRING, description: "Webcam quality, e.g., '1080p FHD IR Webcam'" },
        keyboard: { type: Type.STRING, description: "Keyboard features, e.g., 'Backlit Chiclet Keyboard RGB'" },
        ports: { type: Type.STRING, description: "A summary of available ports, e.g., '1x Thunderbolt 4, 2x USB-A 3.2, 1x HDMI 2.1'" },
    },
    required: ['cpu', 'gpu', 'ram', 'storage', 'display', 'operatingSystem', 'webcam', 'keyboard', 'ports'],
};

const laptopSchema = {
    type: Type.OBJECT,
    properties: {
        modelName: { type: Type.STRING, description: "The specific model name of the laptop." },
        price: { type: Type.NUMBER, description: "The price of the laptop as a number." },
        currency: { type: Type.STRING, description: "The currency code for the price, e.g., 'USD', 'CAD', 'EGP'." },
        retailer: { type: Type.STRING, description: "The name of the retailer selling the laptop." },
        retailerUrl: { type: Type.STRING, description: "The direct, working URL to the product page. If not found, this MUST be an empty string." },
        specs: laptopSpecSchema,
        justification: { type: Type.STRING, description: "A clear explanation of why this specific laptop's specs address the user's needs." },
    },
    required: ['modelName', 'price', 'currency', 'retailer', 'retailerUrl', 'specs', 'justification'],
};

// Function to create AI instance with provided API key
export function getAiInstance(apiKey: string) {
    return new GoogleGenAI({ apiKey });
}

// New function to handle model fallback strategy
async function callWithFallback<T>(
    apiKey: string,
    operation: (model: string) => Promise<T>
): Promise<T> {
    const models = ['gemini-2.5-pro', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];
    let lastError: any;

    for (const model of models) {
        try {
            return await operation(model);
        } catch (error: any) {
            console.warn(`Model ${model} failed:`, error.message);
            lastError = error;
            
            // If it's not a quota error, try the next model
            // For quota errors, we still want to try fallback models
            if (error.status === 429) {
                console.log(`Rate limit hit for ${model}, trying fallback model...`);
            }
        }
    }
    
    // If all models failed, throw the last error
    throw lastError;
}

// Function to validate API key
export async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        const ai = getAiInstance(apiKey);
        // Make a simple request to test the API key
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: 'Hello, this is a test to validate the API key.',
        });
        return !!response.text;
    } catch (error) {
        console.error('API key validation failed:', error);
        return false;
    }
}

export async function getLaptopRecommendations(
  args: RecommendationArgs,
  apiKey: string
): Promise<{ laptops: Laptop[], sources: GroundingSource[] }> {
  const ai = getAiInstance(apiKey);

  const searchPrompt = `
    Find the top 5 best laptop recommendations based on the following criteria for a user in ${args.country}:
    - **Budget:** Around ${args.budget} ${args.currency}
    - **Primary Use:** ${args.primaryUse}
    - **Secondary Use:** ${args.secondaryUse || 'Not specified'}
    - **Specific Needs & Preferences:** ${args.specificNeeds}

    **Instructions & Workflow:**
    1.  **SEARCH:** Use Google Search to find potential laptops from well-known, reputable retailers that operate in and ship to **${args.country}**.
    2.  **NAVIGATE & VERIFY:** For each potential laptop, navigate to the retailer's product page. On that page, extract as much of the following information as possible:
        a.  The exact, current price.
        b.  Availability status ('in stock', 'available for purchase', 'out of stock', etc.)
        c.  Processor model (specific model preferred, but general family is acceptable)
        d.  Graphics card model (dedicated GPU preferred, but integrated graphics are acceptable)
        e.  Amount of RAM (specific amount preferred)
        f.  Storage type and capacity (specific details preferred)
        g.  Display size and resolution (specific details preferred)
        h.  Operating system
        i.  Webcam specifications (resolution and features if available)
        j.  Keyboard features (backlighting, numpad, etc. if available)
        k.  Available ports (USB, HDMI, etc. if available)
    3.  **PRIORITY:** Prioritize laptops where you can verify the price and basic specs, but include laptops even if some details are missing.
    4.  **VALIDATE URL:** The 'retailerUrl' MUST be the final, direct, working URL to the product page.
    5.  **VALIDATE RETAILER:** The 'retailer' name MUST be the official name of the store from the product page.
    6.  **JUSTIFY:** For each recommendation, write a specific justification explaining how its features meet the user's stated needs.
  `;

  try {
    // Use fallback strategy for the search operation
    const searchResponse = await callWithFallback(apiKey, async (model) => {
        return await ai.models.generateContent({
            model: model,
            contents: searchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
    });

    const groundedText = searchResponse.text;
    
    if (!groundedText) {
        throw new Error("The web search did not return any results. This might be a temporary issue.");
    }

    const extractionPrompt = `Based on the following text, extract the information for up to 5 laptop recommendations.
    
    **Rules:**
    1. Only extract data that is explicitly present in the provided text.
    2. If a piece of information (like a URL) is missing or mentioned as unavailable, leave the corresponding JSON field as an empty string. Do not invent or guess any information.
    3. Include laptops even if some information is missing - partial information is better than no recommendation.
    4. **PRIORITY:** Prioritize laptops where you can verify the price and basic specifications.
    5. If you find more than 5 good options, select the 5 most relevant to the user's needs.

    Text: """
    ${groundedText}
    """
    `;

    // Use fallback strategy for the extraction operation
    const extractionResponse = await callWithFallback(apiKey, async (model) => {
        return await ai.models.generateContent({
            model: model,
            contents: extractionPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: laptopSchema,
                },
            },
        });
    });

    const laptops = JSON.parse(extractionResponse.text) as Laptop[];
    
    // Add validation to ensure all required fields are populated with specific information
    const validateLaptopStrict = (laptop: Laptop): boolean => {
        // Check that all basic fields are present
        if (!laptop.modelName || !laptop.retailer || !laptop.retailerUrl) {
            console.warn(`Laptop missing basic information: ${JSON.stringify(laptop)}`);
            return false;
        }
        
        // Check that price is a valid number greater than 0
        if (typeof laptop.price !== 'number' || laptop.price <= 0) {
            console.warn(`Laptop has invalid price: ${laptop.modelName}`);
            return false;
        }
        
        // Check that specs are present
        if (!laptop.specs) {
            console.warn(`Laptop missing specs: ${laptop.modelName}`);
            return false;
        }
        
        const specs = laptop.specs;
        
        // Check for specific, non-generic values
        const isValidCpu = specs.cpu && 
                          specs.cpu.length > 0 && 
                          !specs.cpu.includes('i3/i5') && 
                          !specs.cpu.includes('i5/i7') && 
                          !specs.cpu.includes('Ryzen 3/5') && 
                          !specs.cpu.includes('Ryzen 5/7') &&
                          (specs.cpu.includes('Intel Core') || specs.cpu.includes('AMD Ryzen') || specs.cpu.includes('Apple M'));
                          
        if (!isValidCpu) {
            console.warn(`Laptop has invalid or generic CPU: ${laptop.modelName} - ${specs.cpu}`);
            return false;
        }
        
        // Check for specific GPU information (integrated graphics are acceptable if explicitly stated)
        const isValidGpu = specs.gpu && specs.gpu.length > 0;
        if (!isValidGpu) {
            console.warn(`Laptop has invalid GPU: ${laptop.modelName} - ${specs.gpu}`);
            return false;
        }
        
        // Check for specific RAM information
        const isValidRam = specs.ram && specs.ram.length > 0 && specs.ram.includes('GB');
        if (!isValidRam) {
            console.warn(`Laptop has invalid RAM: ${laptop.modelName} - ${specs.ram}`);
            return false;
        }
        
        // Check for specific storage information
        const isValidStorage = specs.storage && specs.storage.length > 0 && 
                              (specs.storage.includes('GB') || specs.storage.includes('TB'));
        if (!isValidStorage) {
            console.warn(`Laptop has invalid storage: ${laptop.modelName} - ${specs.storage}`);
            return false;
        }
        
        // Check for specific display information
        const isValidDisplay = specs.display && specs.display.length > 0 && 
                              (specs.display.includes('inch') || specs.display.includes('"'));
        if (!isValidDisplay) {
            console.warn(`Laptop has invalid display: ${laptop.modelName} - ${specs.display}`);
            return false;
        }
        
        // Check for specific webcam information
        const isValidWebcam = specs.webcam && specs.webcam.length > 0;
        if (!isValidWebcam) {
            console.warn(`Laptop has invalid webcam: ${laptop.modelName} - ${specs.webcam}`);
            return false;
        }
        
        return true;
    };
    
    // Less strict validation for fallback
    const validateLaptopRelaxed = (laptop: Laptop): boolean => {
        // Check that all basic fields are present
        if (!laptop.modelName || !laptop.retailer || !laptop.retailerUrl) {
            console.warn(`Laptop missing basic information: ${JSON.stringify(laptop)}`);
            return false;
        }
        
        // Check that price is a valid number greater than 0
        if (typeof laptop.price !== 'number' || laptop.price <= 0) {
            console.warn(`Laptop has invalid price: ${laptop.modelName}`);
            return false;
        }
        
        // Check that specs are present
        if (!laptop.specs) {
            console.warn(`Laptop missing specs: ${laptop.modelName}`);
            return false;
        }
        
        const specs = laptop.specs;
        
        // Check for CPU information (allowing some generic terms as fallback)
        const hasCpu = specs.cpu && specs.cpu.length > 0;
        if (!hasCpu) {
            console.warn(`Laptop missing CPU info: ${laptop.modelName}`);
            return false;
        }
        
        // Check for GPU information
        const hasGpu = specs.gpu && specs.gpu.length > 0;
        if (!hasGpu) {
            console.warn(`Laptop missing GPU info: ${laptop.modelName}`);
            return false;
        }
        
        // Check for RAM information
        const hasRam = specs.ram && specs.ram.length > 0;
        if (!hasRam) {
            console.warn(`Laptop missing RAM info: ${laptop.modelName}`);
            return false;
        }
        
        // Check for storage information
        const hasStorage = specs.storage && specs.storage.length > 0;
        if (!hasStorage) {
            console.warn(`Laptop missing storage info: ${laptop.modelName}`);
            return false;
        }
        
        return true;
    };
    
    // Even more relaxed validation for minimal requirements
    const validateLaptopMinimal = (laptop: Laptop): boolean => {
        // Check that we at least have a model name and price
        if (!laptop.modelName) {
            console.warn(`Laptop missing model name: ${JSON.stringify(laptop)}`);
            return false;
        }
        
        // Price is helpful but we can work without it if other info is good
        if (laptop.price && (typeof laptop.price !== 'number' || laptop.price <= 0)) {
            console.warn(`Laptop has invalid price: ${laptop.modelName}`);
            // Don't fail on price alone, just note it
        }
        
        // Check that specs are present
        if (!laptop.specs) {
            console.warn(`Laptop missing specs: ${laptop.modelName}`);
            return false;
        }
        
        const specs = laptop.specs;
        
        // Check for at least some basic specs
        const hasBasicSpecs = (specs.cpu && specs.cpu.length > 0) || 
                             (specs.gpu && specs.gpu.length > 0) || 
                             (specs.ram && specs.ram.length > 0);
        
        if (!hasBasicSpecs) {
            console.warn(`Laptop missing basic specs: ${laptop.modelName}`);
            return false;
        }
        
        return true;
    };
    
    // First try with strict validation
    let validLaptops = laptops.filter(validateLaptopStrict);
    
    // If we don't have enough laptops, try with relaxed validation
    if (validLaptops.length < 2) {
        console.warn(`Only ${validLaptops.length} laptops passed strict validation. Trying relaxed validation.`);
        validLaptops = laptops.filter(validateLaptopRelaxed);
        
        // If we still don't have enough, try with minimal validation
        if (validLaptops.length < 2) {
            console.warn(`Only ${validLaptops.length} laptops passed relaxed validation. Trying minimal validation.`);
            validLaptops = laptops.filter(validateLaptopMinimal);
        }
        
        // Limit to 5 laptops maximum
        if (validLaptops.length > 5) {
            validLaptops = validLaptops.slice(0, 5);
            console.warn(`Found ${laptops.length} laptops, limited to 5 for display.`);
        }
    } else {
        // Limit to 5 laptops maximum
        if (validLaptops.length > 5) {
            validLaptops = validLaptops.slice(0, 5);
            console.warn(`Found ${validLaptops.length} laptops passing strict validation, limited to 5 for display.`);
        }
    }
    
    // If we still have no laptops, try to return something with at least basic information
    if (validLaptops.length === 0 && laptops.length > 0) {
        console.warn(`No laptops passed validation. Returning top 3 laptops with any information.`);
        validLaptops = laptops.slice(0, Math.min(3, laptops.length));
    }
    
    if (validLaptops.length === 0) {
        throw new Error("I couldn't find any laptops that match your criteria. Try adjusting your budget or requirements - for example, consider a higher budget range or different use case.");
    }
    
    console.log(`Returning ${validLaptops.length} laptop recommendations.`);
    
    const rawSources = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources: GroundingSource[] = rawSources
      .map((chunk: any) => ({
        uri: chunk.web?.uri,
        title: chunk.web?.title,
      }))
      .filter((source: GroundingSource) => source.uri && source.title)
      // Deduplicate sources based on URI
      .filter((source, index, self) => index === self.findIndex(s => s.uri === source.uri));


    return { laptops: validLaptops, sources };

  } catch (error) {
    console.error("Error in getLaptopRecommendations:", error);
    // Re-throw the original error so the UI layer can handle it appropriately.
    // The previous implementation was hiding specific errors like 'quota exceeded'.
    throw error;
  }
}

export async function generateLaptopImage(modelName: string, apiKey: string): Promise<string | null> {
    // Check if image generation is disabled
    const IMAGE_GENERATION_ENABLED = true; // Always enable for user-provided keys
    
    // First check if we've hit rate limits recently
    const lastRequestTime = localStorage.getItem('lastImageRequestTime');
    const rateLimitPeriod = 60000; // 1 minute
    if (lastRequestTime) {
        const timeDiff = Date.now() - parseInt(lastRequestTime);
        if (timeDiff < rateLimitPeriod) {
            console.log(`Skipping image request for "${modelName}" due to rate limiting (${Math.ceil((rateLimitPeriod - timeDiff) / 1000)}s remaining)`);
            return null;
        }
    }
    
    try {
        const ai = getAiInstance(apiKey);
        // Instead of generating images, search for them using Google Search
        const searchPrompt = `Find an official product image for '${modelName}' laptop from manufacturer website or major retailer. Return only the image URL.`;
        
        // Use fallback strategy for image search
        const response = await callWithFallback(apiKey, async (model) => {
            return await ai.models.generateContent({
                model: model,
                contents: searchPrompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
        });

        // Update last request time
        localStorage.setItem('lastImageRequestTime', Date.now().toString());

        // Extract image URL from the search results
        if (response.text) {
            // Try to extract URL from the response
            const urlRegex = /(https?:\/\/[^\s"]+\.(?:jpg|jpeg|png|webp))/gi;
            const matches = response.text.match(urlRegex);
            
            if (matches && matches.length > 0) {
                // Return the first valid image URL found
                return matches[0];
            }
        }
        
        // Fallback: Try a more general search
        console.warn(`No image found for "${modelName}" in initial search. Trying fallback search.`);
        const fallbackResponse = await callWithFallback(apiKey, async (model) => {
            return await ai.models.generateContent({
                model: model,
                contents: `Find a high-quality product image for ${modelName} laptop. Return only the image URL.`,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
        });
        
        // Update last request time
        localStorage.setItem('lastImageRequestTime', Date.now().toString());
        
        if (fallbackResponse.text) {
            const urlRegex = /(https?:\/\/[^\s"]+\.(?:jpg|jpeg|png|webp))/gi;
            const matches = fallbackResponse.text.match(urlRegex);
            
            if (matches && matches.length > 0) {
                return matches[0];
            }
        }
        
        console.warn(`No image found for "${modelName}" after fallback search.`);
        return null;

    } catch (error) {
        console.error(`Error searching for image for "${modelName}":`, error);
        // Log additional details if available
        if (error instanceof Error) {
            console.error(`Error name: ${error.name}`);
            console.error(`Error message: ${error.message}`);
            // If it's a Google API error, log additional details
            if ('status' in error) {
                console.error(`API Status: ${(error as any).status}`);
                // If we hit rate limits, store the time to prevent further requests
                if ((error as any).status === 429) {
                    localStorage.setItem('lastImageRequestTime', Date.now().toString());
                }
            }
            if ('code' in error) {
                console.error(`API Code: ${(error as any).code}`);
            }
            if ('details' in error) {
                console.error(`API Details: ${(error as any).details}`);
            }
        }
        // Return null to allow the overall recommendation process to continue gracefully.
        return null;
    }
}

export async function analyzeBestFeatures(
    laptops: Laptop[],
    userNeeds: RecommendationArgs | null,
    apiKey: string,
    isEgypt: boolean = false
): Promise<string[]> {
    const ai = getAiInstance(apiKey);
    if (!userNeeds) return laptops.map(() => 'N/A');
    
    const prompt = isEgypt ? 
        `أنت خبير تكنولوجيا بتلخص لليوزر اختيارات اللابتوبات.
        احتياجات اليوزر الأساسية هي:
        - الاستخدام: ${userNeeds.primaryUse}
        - الميزانية: ~${userNeeds.budget} ${userNeeds.currency}
        - احتياجات تانية: ${userNeeds.specificNeeds}

        دول ${laptops.length} لابتوبات موصى بيها:
        ${laptops.map((l, i) => `
        لابتوب ${i + 1}: ${l.modelName}
        - CPU: ${l.specs.cpu}
        - GPU: ${l.specs.gpu}
        - RAM: ${l.specs.ram}
        - Display: ${l.specs.display}
        - OS: ${l.specs.operatingSystem}
        - Webcam: ${l.specs.webcam}
        - Keyboard: ${l.specs.keyboard}
        - Ports: ${l.specs.ports}
        `).join('')}

        **مهماتك:**
        لو كل لابتوب من دول، اكتب جملة واحدة بس، مختصرة، بتسلط الضوء على أهم feature أو ميزة متميزة ليه بالنسباللاليوزر ده.
        ركز على إيه اللي بيخليه اختيار ممتاز.
        مثال: "Features the most powerful GPU in this list for gaming." أو "Boasts a stunning OLED display ideal for creative work."

        ابعتلي بس JSON object فيه key واحد اسمه "features" واللي هو array من ${laptops.length} strings، واحدة لكل لابتوب بالترتيب اللي اديتهالك.
        ` :
        `
        You are a tech expert summarizing laptop options for a user.
        The user's primary needs are:
        - Use Case: ${userNeeds.primaryUse}
        - Budget: ~${userNeeds.budget} ${userNeeds.currency}
        - Other Needs: ${userNeeds.specificNeeds}

        Here are ${laptops.length} recommended laptops:
        ${laptops.map((l, i) => `
        Laptop ${i + 1}: ${l.modelName}
        - CPU: ${l.specs.cpu}
        - GPU: ${l.specs.gpu}
        - RAM: ${l.specs.ram}
        - Display: ${l.specs.display}
        - OS: ${l.specs.operatingSystem}
        - Webcam: ${l.specs.webcam}
        - Keyboard: ${l.specs.keyboard}
        - Ports: ${l.specs.ports}
        `).join('')}

        **Your Task:**
        For each of the ${laptops.length} laptops, provide a single, concise sentence that highlights its **single best feature or standout highlight** for this user.
        Focus on what makes it a great choice.
        For example: "Features the most powerful GPU in this list for gaming." or "Boasts a stunning OLED display ideal for creative work."

        Return ONLY a JSON object with a single key "features" which is an array of exactly ${laptops.length} strings, one for each laptop in the order they were provided.
        `;

    try {
        // Use fallback strategy for feature analysis
        const response = await callWithFallback(apiKey, async (model) => {
            return await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            features: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                            },
                        },
                        required: ['features'],
                    },
                },
            });
        });

        // Try to parse the response
        let result;
        try {
            result = JSON.parse(response.text);
        } catch (parseError) {
            console.warn("Failed to parse JSON response for feature analysis:", response.text);
            // Try to extract features from the text response directly
            const lines = response.text.split('\n');
            const features: string[] = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('}') && !trimmed.includes('"features"') && trimmed.length > 10) {
                    // This might be a feature description
                    if (!trimmed.includes('Laptop') && !trimmed.includes(':') && trimmed.length > 20) {
                        features.push(trimmed);
                        if (features.length === laptops.length) break;
                    }
                }
            }
            
            if (features.length === laptops.length) {
                return features;
            }
            
            // If we still can't get the right format, return fallback
            throw new Error("Could not extract features from response");
        }

        // Validate the parsed result
        if (result && result.features && Array.isArray(result.features) && result.features.length === laptops.length) {
            return result.features;
        } else {
            // Try to extract features from the text response directly
            const lines = response.text.split('\n');
            const features: string[] = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('}') && !trimmed.includes('"features"') && trimmed.length > 10) {
                    // This might be a feature description
                    if (!trimmed.includes('Laptop') && !trimmed.includes(':') && trimmed.length > 20) {
                        features.push(trimmed);
                        if (features.length === laptops.length) break;
                    }
                }
            }
            
            if (features.length === laptops.length) {
                return features;
            }
            
            throw new Error(`AI response for feature analysis did not match the expected format. Expected ${laptops.length} features, got ${result?.features?.length || 0}`);
        }

    } catch (error) {
        console.error("Error analyzing laptop best features:", error);
        // Return a fallback array in case of an error as this is non-critical
        return laptops.map(() => "Analysis could not be generated.");
    }
}