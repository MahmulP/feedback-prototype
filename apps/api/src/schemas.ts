import { z } from "zod";

/** Runtime mirrors of the shared-types wire shapes. */

export const coordinatesSchema = z.object({
  xPercent: z.number().min(0).max(1),
  yPercent: z.number().min(0).max(1),
  xPx: z.number().int(),
  yPx: z.number().int(),
});

export const viewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  devicePixelRatio: z.number().positive(),
});

export const authorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email().max(200).optional(),
});

export const commentInputSchema = z.object({
  author: authorSchema,
  body: z.string().trim().min(1).max(4000),
});

export const createFeedbackSchema = z.object({
  projectId: z.string().min(1).max(80),
  pageUrl: z.string().min(1).max(2000),
  selector: z.string().min(1).max(2000),
  coordinates: coordinatesSchema,
  viewport: viewportSchema,
  comment: commentInputSchema.optional(),
});

export const listQuerySchema = z.object({
  projectId: z.string().min(1).max(80),
  pageUrl: z.string().max(2000).optional(),
  status: z.enum(["open", "resolved", "archived"]).optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(["open", "resolved", "archived"]),
});

export const coordinatesUpdateSchema = z.object({
  coordinates: coordinatesSchema,
});
