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
  pageUrl: z.string().min(1).max(2000),
  selector: z.string().min(1).max(2000),
  coordinates: coordinatesSchema,
  viewport: viewportSchema,
  comment: commentInputSchema.optional(),
});

export const listQuerySchema = z.object({
  pageUrl: z.string().max(2000).optional(),
  status: z.enum(["open", "resolved", "archived"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(["open", "resolved", "archived"]),
});

export const coordinatesUpdateSchema = z.object({
  coordinates: coordinatesSchema,
});

// --- users + projects -------------------------------------------------

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const projectCreateSchema = z.object({
  slug: z.string().trim().regex(slugPattern, "slug must be lowercase letters, digits, and dashes"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  allowedOrigins: z.array(z.string().url().max(200)).max(20).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  allowedOrigins: z.array(z.string().url().max(200)).max(20).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["editor", "viewer"]).default("viewer"),
});

export const createShareLinkSchema = z.object({
  label: z.string().trim().max(80).optional(),
  expiresInDays: z.number().int().positive().max(365).optional(),
});
