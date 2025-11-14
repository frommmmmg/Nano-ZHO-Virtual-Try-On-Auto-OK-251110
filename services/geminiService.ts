
import { GoogleGenAI, Modality } from "@google/genai";
import type { GeneratedContent } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function editImage(
    images: { base64: string; mimeType: string }[],
    prompt: string,
    maskBase64: string | null
): Promise<GeneratedContent> {
  try {
    if (images.length === 0) {
      throw new Error("At least one image must be provided for editing.");
    }
    
    let fullPrompt = prompt;
    
    const parts: any[] = images.map(image => ({
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    }));

    if (maskBase64) {
      parts.push({
        inlineData: {
          data: maskBase64,
          mimeType: 'image/png',
        },
      });
      fullPrompt = `Apply the following instruction only to the masked area of the image: "${prompt}". Preserve the unmasked area.`;
    }

    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const result: GeneratedContent = { imageUrl: null, text: null };
    const responseParts = response.candidates?.[0]?.content?.parts;

    if (responseParts) {
      for (const part of responseParts) {
        if (part.text) {
          result.text = (result.text ? result.text + "\n" : "") + part.text;
        } else if (part.inlineData) {
          result.imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    if (!result.imageUrl) {
        let errorMessage;
        if (result.text) {
            errorMessage = `The model responded: "${result.text}"`;
        } else {
            const finishReason = response.candidates?.[0]?.finishReason;
            const safetyRatings = response.candidates?.[0]?.safetyRatings;
            errorMessage = "The model did not return an image. It might have refused the request. Please try a different image or prompt.";
            
            if (finishReason === 'SAFETY') {
                const blockedCategories = safetyRatings?.filter(r => r.blocked).map(r => r.category).join(', ');
                errorMessage = `The request was blocked for safety reasons. Categories: ${blockedCategories || 'Unknown'}. Please modify your prompt or image.`;
            }
        }
        throw new Error(errorMessage);
    }

    return result;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        let errorMessage = error.message;
        try {
            const parsedError = JSON.parse(errorMessage);
            if (parsedError.error && parsedError.error.message) {
                if (parsedError.error.status === 'RESOURCE_EXHAUSTED') {
                    errorMessage = "You've likely exceeded the request limit. Please wait a moment before trying again.";
                } else if (parsedError.error.code === 500 || parsedError.error.status === 'UNKNOWN') {
                    errorMessage = "An unexpected server error occurred. This might be a temporary issue. Please try again in a few moments.";
                } else {
                    errorMessage = parsedError.error.message;
                }
            }
        } catch (e) {}
        throw new Error(errorMessage);
    }
    throw new Error("An unknown error occurred while communicating with the API.");
  }
}

export async function generateImage(prompt: string): Promise<GeneratedContent> {
  try {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("The model did not return an image. It might have refused the request. Please try different options.");
    }
    
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
    
    return { imageUrl: imageUrl, text: null };

  } catch (error) {
    console.error("Error calling Gemini API for image generation:", error);
    if (error instanceof Error) {
        let errorMessage = error.message;
         try {
            const parsedError = JSON.parse(errorMessage);
            if (parsedError.error && parsedError.error.message) {
                if (parsedError.error.status === 'RESOURCE_EXHAUSTED') {
                    errorMessage = "You've likely exceeded the request limit. Please wait a moment before trying again.";
                } else if (parsedError.error.code === 500 || parsedError.error.status === 'UNKNOWN') {
                    errorMessage = "An unexpected server error occurred. This might be a temporary issue. Please try again in a few moments.";
                } else {
                    errorMessage = parsedError.error.message;
                }
            }
        } catch (e) {}
        throw new Error(errorMessage);
    }
    throw new Error("An unknown error occurred while generating the image.");
  }
}

export async function generateVideo(
    prompt: string,
    image: { base64: string; mimeType: string } | null,
    aspectRatio: '16:9' | '9:16',
    onProgress: (message: string) => void
): Promise<Blob> {
    try {
        onProgress("Initializing video generation...");

        const request = {
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                aspectRatio: aspectRatio
            },
            ...(image && {
                image: {
                    imageBytes: image.base64,
                    mimeType: image.mimeType
                }
            })
        };

        let operation = await ai.models.generateVideos(request);
        
        onProgress("Polling for results, this may take a few minutes...");

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if (operation.error) {
            throw new Error(String(operation.error.message) || "Video generation failed during operation.");
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        onProgress("Finalizing and fetching your video...");
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!response.ok) {
            throw new Error(`Failed to download video file. Status: ${response.statusText}`);
        }
        const blob = await response.blob();
        return blob;

    } catch (error) {
        console.error("Error calling Video Generation API:", error);
        if (error instanceof Error) {
            let errorMessage = error.message;
            try {
                const parsedError = JSON.parse(errorMessage);
                if (parsedError.error && parsedError.error.message) {
                    errorMessage = parsedError.error.message;
                }
            } catch (e) {}
            throw new Error(errorMessage);
        }
        throw new Error("An unknown error occurred during video generation.");
    }
}