/**
 * Session Management Service
 * 
 * Handles session creation and management for authenticated users
 */

import { Response } from 'express';
import { getSessionCookieOptions } from '../_core/cookies';
import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';
import { sdk } from '../_core/sdk';

/**
 * Create a session for a user and set the session cookie
 * 
 * @param res - Express response object
 * @param userId - User ID
 * @param openId - User's openId (or generated one for email/password users)
 * @returns Session token
 */
export async function createUserSession(
  res: Response,
  userId: number,
  openId: string,
  req: any
): Promise<string> {
  // Create session token using Manus SDK
  const sessionToken = await sdk.createSessionToken(openId, {
    userId: userId.toString(),
  });

  // Set session cookie
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, {
    ...cookieOptions,
    maxAge: ONE_YEAR_MS,
  });

  return sessionToken;
}

/**
 * Clear user session (logout)
 */
export function clearUserSession(res: Response, req: any): void {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, {
    ...cookieOptions,
    maxAge: -1,
  });
}
