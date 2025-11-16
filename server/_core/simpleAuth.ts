import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import bcrypt from "bcryptjs";

/**
 * Simple authentication system for beta deployment
 * Replaces AWS Cognito with email/password authentication
 */

export function registerSimpleAuthRoutes(app: Express) {
  // Register endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      // Check if user already exists
      const existingUser = await db.getUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: "User already exists" });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const openId = "email:" + email;
      await db.upsertUser({
        openId,
        name: name || email.split("@")[0],
        email,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });

      // Store password hash (you'll need to add this to your database schema)
      await db.storePasswordHash(openId, passwordHash);

      // Create session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Registration successful" });
    } catch (error) {
      console.error("[Auth] Registration failed", error);
      res.status(500).json({ 
        error: "Registration failed",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      // Get user
      const user = await db.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Verify password
      const passwordHash = await db.getPasswordHash(user.openId);
      if (!passwordHash) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const isValid = await bcrypt.compare(password, passwordHash);
      if (!isValid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Update last signed in
      await db.updateLastSignedIn(user.openId);

      // Create session token
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Login successful" });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ 
        error: "Login failed",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true, message: "Logout successful" });
  });

  // OAuth callback endpoint (for compatibility)
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    // Redirect to login page for beta version
    res.redirect(302, "/sign-in?message=Please use email/password login for beta version");
  });
}
