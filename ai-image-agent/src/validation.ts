import { z } from 'zod';

const hexColor = z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Invalid hex color');

export const generateImageSchema = z.object({
  inputText: z.string().min(10),
  designGuidelines: z.string().min(10),
  platform: z.enum(['instagram_feed_1x1', 'instagram_feed_4x5']).default('instagram_feed_1x1'),
  brandKit: z.object({
    primaryColor: hexColor,
    secondaryColor: hexColor,
    accentColor: hexColor,
    backgroundColor: hexColor,
    textColor: hexColor,
    headingFont: z.string().min(2),
    bodyFont: z.string().min(2),
    logoUrl: z.string().url().optional(),
  }),
});

export const approvalSchema = z.object({
  reviewer: z.string().min(2),
});

export const rejectionSchema = z.object({
  reviewer: z.string().min(2),
  reason: z.string().min(3),
});
