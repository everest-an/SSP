import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import axios from "axios";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

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
  sub: string; // Cognito user ID
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
      // Check if using Cognito (based on OAuth portal URL)
      const isCognito = ENV.oAuthServerUrl?.includes("amazoncognito.com") || 
                        process.env.VITE_OAUTH_PORTAL_URL?.includes("amazoncognito.com");
      
      console.log("[OAuth] ENV.oAuthServerUrl:", ENV.oAuthServerUrl);
      console.log("[OAuth] VITE_OAUTH_PORTAL_URL:", process.env.VITE_OAUTH_PORTAL_URL);
      console.log("[OAuth] isCognito:", isCognito);

      if (isCognito) {
        // AWS Cognito OAuth flow
        console.log("[OAuth] Using Cognito OAuth flow");
        await handleCognitoCallback(req, res, code, state);
      } else {
        // Manus OAuth flow (original logic)
        console.log("[OAuth] Using Manus OAuth flow");
        await handleManusCallback(req, res, code, state);
      }
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
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
  const cognitoDomain = ENV.oAuthServerUrl;
  const clientId = ENV.appId;

  // Exchange code for tokens
  const tokenUrl = `${cognitoDomain}/oauth2/token`;
  const tokenResponse = await axios.post<CognitoTokenResponse>(
    tokenUrl,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, id_token } = tokenResponse.data;

  // Get user info
  const userInfoUrl = `${cognitoDomain}/oauth2/userInfo`;
  const userInfoResponse = await axios.get<CognitoUserInfo>(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  const userInfo = userInfoResponse.data;
  const openId = `cognito:${userInfo.sub}`;

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

  // Redirect to dashboard instead of home
  res.redirect(302, "/dashboard");
}

async function handleManusCallback(
  req: Request,
  res: Response,
  code: string,
  state: string
) {
  const tokenResponse = await sdk.exchangeCodeForToken(code, state);
  const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

  if (!userInfo.openId) {
    res.status(400).json({ error: "openId missing from user info" });
    return;
  }

  await db.upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn: new Date(),
  });

  const sessionToken = await sdk.createSessionToken(userInfo.openId, {
    name: userInfo.name || "",
    expiresInMs: ONE_YEAR_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

  // Redirect to dashboard instead of home
  res.redirect(302, "/dashboard");
}
