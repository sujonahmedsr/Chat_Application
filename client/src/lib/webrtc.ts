import { getApiBaseUrl } from './api';

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

let cachedRtcConfig: RTCConfiguration | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Retrieves the optimal WebRTC configuration with STUN and TURN relay servers.
 * Prioritizes backend /calls/ice-servers (which pulls from Metered TURN if configured),
 * with client-side fallback to direct Metered.ca API or public STUN servers.
 */
export const getWebRtcConfiguration = async (): Promise<RTCConfiguration> => {
  const now = Date.now();
  if (cachedRtcConfig && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedRtcConfig;
  }

  // 1. Try fetching from Backend /api/calls/ice-servers
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/calls/ice-servers`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        cachedRtcConfig = {
          iceServers: data.iceServers,
          iceCandidatePoolSize: 10,
        };
        cacheTimestamp = now;
        return cachedRtcConfig;
      }
    }
  } catch (err) {
    console.warn('[WebRTC] Backend ice-servers endpoint unreachable, trying client fallback:', err);
  }

  // 2. Direct client-side Metered.ca fallback if configured in client env
  const rawClientAppName = process.env.NEXT_PUBLIC_METERED_APP_NAME;
  const clientApiKey = process.env.NEXT_PUBLIC_METERED_API_KEY;

  if (rawClientAppName && clientApiKey) {
    try {
      const clientAppName = rawClientAppName.replace(/https?:\/\//, '').replace('.metered.live', '').trim();
      let res = await fetch(
        `https://${clientAppName}.metered.live/api/v1/turn/credentials?apiKey=${clientApiKey}`
      );
      let meteredServers = res.ok ? await res.json() : null;

      if (!Array.isArray(meteredServers) || meteredServers.length === 0) {
        const secretRes = await fetch(
          `https://${clientAppName}.metered.live/api/v1/turn/credential?secretKey=${clientApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }
        );
        if (secretRes.ok) {
          const credData = await secretRes.json();
          if (credData.apiKey) {
            const retry = await fetch(
              `https://${clientAppName}.metered.live/api/v1/turn/credentials?apiKey=${credData.apiKey}`
            );
            if (retry.ok) {
              meteredServers = await retry.json();
            }
          } else if (credData.username && credData.password) {
            meteredServers = [
              { urls: 'stun:stun.relay.metered.ca:80' },
              {
                urls: [
                  'turn:global.relay.metered.ca:80',
                  'turn:global.relay.metered.ca:80?transport=tcp',
                  'turn:global.relay.metered.ca:443',
                  'turns:global.relay.metered.ca:443?transport=tcp',
                ],
                username: credData.username,
                credential: credData.password,
              },
            ];
          }
        }
      }

      if (Array.isArray(meteredServers) && meteredServers.length > 0) {
        cachedRtcConfig = {
          iceServers: [...DEFAULT_ICE_SERVERS, ...meteredServers],
          iceCandidatePoolSize: 10,
        };
        cacheTimestamp = now;
        return cachedRtcConfig;
      }
    } catch (err) {
      console.warn('[WebRTC] Direct client metered fetch failed:', err);
    }
  }

  // 3. Fallback to reliable Google & Cloudflare STUN servers
  cachedRtcConfig = {
    iceServers: DEFAULT_ICE_SERVERS,
    iceCandidatePoolSize: 10,
  };
  cacheTimestamp = now;
  return cachedRtcConfig;
};
