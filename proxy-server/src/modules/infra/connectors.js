const axios = require('axios');
const https = require('node:https');
const path = require('node:path');
const fs = require('node:fs');
const { Client: SSHClient } = require('ssh2');
const { logger } = require('../../observability/logger');

function createInfraConnectors({ settingsReader, setProxmoxTarget }) {
  const proxmoxAgent = new https.Agent({ rejectUnauthorized: false });

  const proxmoxSession = {
    ticket: null,
    csrfToken: null,
    expiresAt: 0,
    baseUrl: '',
    node: 'h1',
    username: '',
    loginData: null,
  };

  async function getProxmoxSettings() {
    const fallback = {
      url: String(process.env.PROXMOX_URL || 'https://127.0.0.1:8006').trim(),
      username: String(process.env.PROXMOX_USERNAME || 'root').trim(),
      password: String(process.env.PROXMOX_PASSWORD || ''),
      node: String(process.env.PROXMOX_NODE || 'h1').trim(),
    };

    try {
      const data = await settingsReader?.readPath('settings/vmgenerator/proxmox', {
        fallback: null,
      });
      if (data) return data;
    } catch (error) {
      logger.error({ err: error }, 'Error reading Proxmox settings from Supabase settings');
    }

    return fallback;
  }

  async function getSSHSettings() {
    const fallback = {
      host: String(process.env.SSH_HOST || '127.0.0.1').trim(),
      port: Number(process.env.SSH_PORT || 22),
      username: String(process.env.SSH_USERNAME || 'root').trim(),
      useKeyAuth:
        String(process.env.SSH_USE_KEY_AUTH || 'true')
          .trim()
          .toLowerCase() !== 'false',
      password: String(process.env.SSH_PASSWORD || ''),
      privateKeyPath: String(process.env.SSH_PRIVATE_KEY_PATH || '').trim(),
    };

    try {
      const data = await settingsReader?.readPath('settings/vmgenerator/ssh', { fallback: null });
      if (data) return data;
    } catch (error) {
      logger.error({ err: error }, 'Error reading SSH settings from Supabase settings');
    }

    return fallback;
  }

  async function proxmoxLogin(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && proxmoxSession.ticket && now < proxmoxSession.expiresAt) {
      return proxmoxSession;
    }

    const settings = await getProxmoxSettings();
    const baseUrl = String(settings.url || '').replace(/\/+$/, '');
    const rawUsername = String(settings.username || 'root').trim();
    const proxmoxUsername = rawUsername.includes('@')
      ? rawUsername
      : `${rawUsername || 'root'}@pam`;

    const response = await axios.post(
      `${baseUrl}/api2/json/access/ticket`,
      `username=${encodeURIComponent(proxmoxUsername)}&password=${encodeURIComponent(settings.password || '')}`,
      {
        httpsAgent: proxmoxAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      },
    );

    const loginData = response?.data?.data || {};
    const { ticket, CSRFPreventionToken } = loginData;

    proxmoxSession.ticket = ticket;
    proxmoxSession.csrfToken = CSRFPreventionToken;
    proxmoxSession.expiresAt = now + 90 * 60 * 1000;
    proxmoxSession.baseUrl = baseUrl;
    proxmoxSession.node = settings.node || 'h1';
    proxmoxSession.username = loginData.username || proxmoxUsername;
    proxmoxSession.loginData = loginData;

    if (typeof setProxmoxTarget === 'function') {
      setProxmoxTarget(baseUrl);
    }

    logger.info('Proxmox session authenticated');
    return proxmoxSession;
  }

  async function proxmoxRequest(method, apiPath, data = null) {
    const session = await proxmoxLogin();
    const url = `${session.baseUrl}${apiPath}`;

    const config = {
      method,
      url,
      httpsAgent: proxmoxAgent,
      timeout: 30000,
      headers: {
        Cookie: `PVEAuthCookie=${session.ticket}`,
        CSRFPreventionToken: session.csrfToken,
      },
    };

    if (data && (method === 'post' || method === 'put')) {
      if (typeof data === 'string') {
        config.data = data;
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        config.data = Object.entries(data)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    const response = await axios(config);
    return response.data;
  }

  function sshExec(command, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      getSSHSettings()
        .then((settings) => {
          const conn = new SSHClient();
          let stdout = '';
          let stderr = '';
          let timedOut = false;

          const timer = setTimeout(() => {
            timedOut = true;
            conn.end();
            reject(new Error('SSH command timed out'));
          }, timeoutMs);

          conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
              if (err) {
                clearTimeout(timer);
                conn.end();
                reject(err);
                return;
              }

              stream.on('close', (code) => {
                clearTimeout(timer);
                conn.end();
                if (!timedOut) {
                  resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
                }
              });

              stream.on('data', (data) => {
                stdout += data.toString();
              });
              stream.stderr.on('data', (data) => {
                stderr += data.toString();
              });
            });
          });

          conn.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });

          const connectConfig = {
            host: settings.host,
            port: settings.port || 22,
            username: settings.username || 'root',
          };

          if (settings.useKeyAuth !== false) {
            const keyPaths = [
              settings.privateKeyPath,
              path.join(process.env.USERPROFILE || process.env.HOME || '', '.ssh', 'id_rsa'),
              path.join(process.env.USERPROFILE || process.env.HOME || '', '.ssh', 'id_ed25519'),
            ].filter(Boolean);

            let keyLoaded = false;
            for (const keyPath of keyPaths) {
              try {
                if (fs.existsSync(keyPath)) {
                  connectConfig.privateKey = fs.readFileSync(keyPath);
                  keyLoaded = true;
                  break;
                }
              } catch {
                // Try next key path.
              }
            }

            if (!keyLoaded && settings.password) {
              connectConfig.password = settings.password;
            }
          } else if (settings.password) {
            connectConfig.password = settings.password;
          }

          conn.connect(connectConfig);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  return {
    proxmoxAgent,
    proxmoxSession,
    proxmoxLogin,
    proxmoxRequest,
    sshExec,
  };
}

module.exports = {
  createInfraConnectors,
};
