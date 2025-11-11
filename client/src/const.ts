export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "App";

export const APP_LOGO =
  import.meta.env.VITE_APP_LOGO ||
  "/logo.png";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  // Check if using AWS Cognito (contains 'amazoncognito.com')
  if (oauthPortalUrl && oauthPortalUrl.includes('amazoncognito.com')) {
    // AWS Cognito OAuth 2.0 flow
    const url = new URL(`${oauthPortalUrl}/oauth2/authorize`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "email openid profile");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  // Default: Manus OAuth or custom OAuth
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};