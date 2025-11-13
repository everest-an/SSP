/**
 * Social Authentication Service
 * 
 * Handles:
 * - Google OAuth
 * - WeChat OAuth
 * - Apple Sign-in
 * - Social account linking
 */

import { nanoid } from 'nanoid';

/**
 * OAuth provider types
 */
export type OAuthProvider = 'google' | 'wechat' | 'apple';

/**
 * OAuth token data
 */
export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string[];
}

/**
 * OAuth user profile
 */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  name?: string;
  picture?: string;
  locale?: string;
}

/**
 * Social account linked to user
 */
export interface SocialAccount {
  id: string;
  userId: number;
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  name?: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory storage for demo (use database in production)
 */
const socialAccounts = new Map<string, SocialAccount>();

/**
 * Generate Google OAuth URL
 */
export function generateGoogleOAuthUrl(redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
  const scope = encodeURIComponent('openid email profile');
  const responseType = 'code';
  const state = nanoid();
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${scope}&state=${state}`;
}

/**
 * Exchange Google authorization code for tokens
 */
export async function exchangeGoogleCode(code: string): Promise<OAuthToken> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to exchange Google code');
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope?.split(' ') || [],
    };
  } catch (error) {
    console.error('[SocialAuth] Google code exchange failed:', error);
    throw error;
  }
}

/**
 * Get Google user profile
 */
export async function getGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get Google profile');
    }
    
    const data = await response.json();
    
    return {
      provider: 'google',
      providerId: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
      locale: data.locale,
    };
  } catch (error) {
    console.error('[SocialAuth] Failed to get Google profile:', error);
    throw error;
  }
}

/**
 * Generate WeChat OAuth URL
 */
export function generateWeChatOAuthUrl(redirectUri: string): string {
  const appId = process.env.WECHAT_APP_ID || 'your-wechat-app-id';
  const scope = 'snsapi_userinfo';
  const state = nanoid();
  
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;
}

/**
 * Exchange WeChat authorization code for tokens
 */
export async function exchangeWeChatCode(code: string): Promise<OAuthToken> {
  try {
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;
    
    if (!appId || !appSecret) {
      throw new Error('WeChat OAuth credentials not configured');
    }
    
    const response = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`
    );
    
    if (!response.ok) {
      throw new Error('Failed to exchange WeChat code');
    }
    
    const data = await response.json();
    
    if (data.errcode) {
      throw new Error(`WeChat error: ${data.errmsg}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope?.split(',') || [],
    };
  } catch (error) {
    console.error('[SocialAuth] WeChat code exchange failed:', error);
    throw error;
  }
}

/**
 * Get WeChat user profile
 */
export async function getWeChatProfile(accessToken: string, openId: string): Promise<OAuthProfile> {
  try {
    const response = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openId}&lang=zh_CN`
    );
    
    if (!response.ok) {
      throw new Error('Failed to get WeChat profile');
    }
    
    const data = await response.json();
    
    if (data.errcode) {
      throw new Error(`WeChat error: ${data.errmsg}`);
    }
    
    return {
      provider: 'wechat',
      providerId: data.openid,
      name: data.nickname,
      picture: data.headimgurl,
      locale: data.language,
    };
  } catch (error) {
    console.error('[SocialAuth] Failed to get WeChat profile:', error);
    throw error;
  }
}

/**
 * Generate Apple Sign-in URL
 */
export function generateAppleSignInUrl(redirectUri: string): string {
  const clientId = process.env.APPLE_CLIENT_ID || 'your-apple-client-id';
  const teamId = process.env.APPLE_TEAM_ID || 'your-team-id';
  const keyId = process.env.APPLE_KEY_ID || 'your-key-id';
  const state = nanoid();
  
  return `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&response_mode=form_post&scope=email%20name&state=${state}`;
}

/**
 * Exchange Apple authorization code for tokens
 */
export async function exchangeAppleCode(code: string): Promise<OAuthToken> {
  try {
    const clientId = process.env.APPLE_CLIENT_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = process.env.APPLE_PRIVATE_KEY;
    const redirectUri = process.env.APPLE_REDIRECT_URI;
    
    if (!clientId || !teamId || !keyId || !privateKey || !redirectUri) {
      throw new Error('Apple Sign-in credentials not configured');
    }
    
    // In production, you would create a JWT token using the private key
    // For now, just return a placeholder
    
    const response = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: 'your-client-secret', // Would be JWT in production
        redirect_uri: redirectUri,
      }).toString(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to exchange Apple code');
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: ['email', 'name'],
    };
  } catch (error) {
    console.error('[SocialAuth] Apple code exchange failed:', error);
    throw error;
  }
}

/**
 * Decode Apple ID token
 */
export async function decodeAppleIdToken(idToken: string): Promise<OAuthProfile> {
  try {
    // In production, verify the JWT signature
    // For now, just decode the payload
    
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid ID token');
    }
    
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString()
    );
    
    return {
      provider: 'apple',
      providerId: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  } catch (error) {
    console.error('[SocialAuth] Failed to decode Apple ID token:', error);
    throw error;
  }
}

/**
 * Link social account to user
 */
export async function linkSocialAccount(
  userId: number,
  profile: OAuthProfile,
  token: OAuthToken
): Promise<SocialAccount> {
  try {
    const id = nanoid();
    
    const account: SocialAccount = {
      id,
      userId,
      provider: profile.provider,
      providerId: profile.providerId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt: token.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    socialAccounts.set(id, account);
    
    return account;
  } catch (error) {
    console.error('[SocialAuth] Failed to link social account:', error);
    throw error;
  }
}

/**
 * Get social account by provider and provider ID
 */
export async function getSocialAccount(
  provider: OAuthProvider,
  providerId: string
): Promise<SocialAccount | null> {
  try {
    for (const [, account] of socialAccounts) {
      if (account.provider === provider && account.providerId === providerId) {
        return account;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[SocialAuth] Failed to get social account:', error);
    throw error;
  }
}

/**
 * Get user social accounts
 */
export async function getUserSocialAccounts(userId: number): Promise<SocialAccount[]> {
  try {
    const accounts: SocialAccount[] = [];
    
    for (const [, account] of socialAccounts) {
      if (account.userId === userId) {
        accounts.push(account);
      }
    }
    
    return accounts;
  } catch (error) {
    console.error('[SocialAuth] Failed to get user social accounts:', error);
    throw error;
  }
}

/**
 * Unlink social account
 */
export async function unlinkSocialAccount(accountId: string): Promise<boolean> {
  try {
    return socialAccounts.delete(accountId);
  } catch (error) {
    console.error('[SocialAuth] Failed to unlink social account:', error);
    throw error;
  }
}

/**
 * Refresh OAuth token
 */
export async function refreshOAuthToken(
  provider: OAuthProvider,
  refreshToken: string
): Promise<OAuthToken> {
  try {
    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId || '',
          client_secret: clientSecret || '',
        }).toString(),
      });
      
      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000),
        scope: data.scope?.split(' ') || [],
      };
    }
    
    throw new Error(`Token refresh not implemented for ${provider}`);
  } catch (error) {
    console.error('[SocialAuth] Token refresh failed:', error);
    throw error;
  }
}
