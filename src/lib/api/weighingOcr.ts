import { dbClient } from "./client";

export const weighingOcr = {
  read: async (imageDataUrl: string): Promise<{ value: number | null; unit: string | null; confidence: number }> => {
    const res = await (dbClient as any).functions.invoke("weighing-ocr", {
      body: { image: imageDataUrl },
    });
    if (res.error) throw new Error(res.error.message ?? String(res.error));
    return res.data as any;
  },
};
