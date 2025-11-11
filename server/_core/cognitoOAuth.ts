import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import axios from "axios";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

interface CognitoTokenResponse {
  id_token: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface CognitoUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export function registerCognitoOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      console.log("[OAuth] Using Cognito OAuth flow");
      await handleCognitoCallback(req, res, code, state);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ 
        error: "OAuth callback failed",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

async function handleCognitoCallback(
  req: Request,
  res: Response,
  code: string,
  state: string
) {
  const redirectUri = atob(state);
  const cognitoDomain = process.env.VITE_OAUTH_PORTAL_URL || "https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com";
  const clientId = process.env.VITE_APP_ID || "3vdjmnldb67uu2jnuqt3uhaqth";
  const clientSecret = process.env.COGNITO_CLIENT_SECRET || "";

  console.log("[OAuth] Cognito domain:", cognitoDomain);
  console.log("[OAuth] Client ID:", clientId);
  console.log("[OAuth] Redirect URI:", redirectUri);

  // Exchange code for tokens
  const tokenUrl = cognitoDomain + "/oauth2/token";
  const tokenResponse = await axios.post<CognitoTokenResponse>(
    tokenUrl,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token } = tokenResponse.data;
  console.log("[OAuth] Token exchange successful");

  // Get user info
  const userInfoUrl = cognitoDomain + "/oauth2/userInfo";
  const userInfoResponse = await axios.get<CognitoUserInfo>(userInfoUrl, {
    headers: {
      Authorization: "Bearer " + access_token,
    },
  });

  const userInfo = userInfoResponse.data;
  const openId = "cognito:" + userInfo.sub;

  console.log("[OAuth] User info retrieved:", { openId, email: userInfo.email });

  // Upsert user in database
  await db.upsertUser({
    openId,
    name: userInfo.name || userInfo.email?.split("@")[0] || null,
    email: userInfo.email || null,
    loginMethod: "cognito",
    lastSignedIn: new Date(),
  });

  // Create session token
  const sessionToken = await sdk.createSessionToken(openId, {
    name: userInfo.name || userInfo.email || "",
    expiresInMs: ONE_YEAR_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

  console.log("[OAuth] Login successful, redirecting to /dashboard");
  
  // Redirect to dashboard
  res.redirect(302, "/dashboard");
}
