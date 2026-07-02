import rateLimit from "express-rate-limit";

// Login rate limiter: max 5 attempts per 10 minutes per IP, to slow down brute force.
export const loginRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again in a few minutes.",
  },
});

// General API limiter, more permissive.
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});
