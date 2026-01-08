import OpenAI from 'openai';
import { SourceImage, ProcessedImage } from '../types';

export const processImagesWithOpenAI = async (
    sourceImages: SourceImage[],
    prompt: string,
    apiKey: string,
    onStatusUpdate?: (msg: string) => void,
    aspectRatio: string = '1024x1024'
): Promise<ProcessedImage[]> => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const promises = sourceImages.map(async (img, idx) => {
        if (onStatusUpdate) onStatusUpdate(`Analyzing image ${idx + 1}/${sourceImages.length} with OpenAI...`);

        // Step 1: Analyze image for product preservation
        // We'll use GPT-4o with Vision for analysis if possible, 
        // but for now we'll focus on the generation part since DALL-E 3 is a text-to-image model.
        // NOTE: DALL-E 3 doesn't typically take an image input for "editing" in the same way Gemini does (image-to-image).
        // It's more of a text-to-image model. However, we can use GPT-4o to describe the image and then generate.

        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(img.file);
        });

        if (onStatusUpdate) onStatusUpdate(`Generating image ${idx + 1}/${sourceImages.length} with DALL-E...`);

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: aspectRatio as any || "1024x1024",
            response_format: "b64_json"
        });

        const b64Data = response.data[0].b64_json;
        return {
            url: `data:image/png;base64,${b64Data}`,
            filename: `${img.label || 'processed'}-${Date.now()}`
        };
    });

    return Promise.all(promises);
};

export const analyzeWithOpenAI = async (file: File, apiKey: string): Promise<string> => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
    });

    const response = await openai.chat.completions.create({
        model: "gpt-image-1.5",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "Describe this product in detail for an image generation prompt. Focus on preserving logos, materials, and colors." },
                    { type: "image_url", image_url: { url: base64 } }
                ],
            },
        ],
    });

    return response.choices[0].message.content || "";
};
