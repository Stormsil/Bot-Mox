const axios = require('axios');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { Client: SSHClient } = require('ssh2');

function createInfraConnectors({
  admin,
  isFirebaseReady,
  setProxmoxTarget,
}) {
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

    if (typeof isFirebaseReady === 'function' && !isFirebaseReady()) {
      return fallback;
    }

    try {
      const db = admin.database();
      const snapshot = await db.ref('settings/vmgenerator/proxmox').once('value');
      const data = snapshot.val();
      if (data) return data;
    } catch (error) {
      console.error('Error reading Proxmox settings from Firebase:', error.message);
    }

    return fallback;
  }

  async function getSSHSettings() {
    const fallback = {
      host: String(process.env.SSH_HOST || '127.0.0.1').trim(),
      port: Number(process.env.SSH_PORT || 22),
      username: String(process.env.SSH_USERNAME || 'root').trim(),
      useKeyAuth: String(process.env.SSH_USE_KEY_AUTH || 'true').trim().toLowerCase() !== 'false',
      password: String(process.env.SSH_PASSWORD || ''),
      privateKeyPath: String(process.env.SSH_PRIVATE_KEY_PATH || '').trim(),
    };

    if (typeof isFirebaseReady === 'function' && !isFirebaseReady()) {
      return fallback;
    }

    try {
      const db = admin.database();
      const snapshot = await db.ref('settings/vmgenerator/ssh').once('value');
      const data = snapshot.val();
      if (data) return data;
    } catch (error) {
      console.error('Error reading SSH settings from Firebase:', error.message);
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
      }
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

    console.log('Proxmox session authenticated');
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
    return new Promise(async (resolve, reject) => {
      const settings = await getSSHSettings();
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
            return reject(err);
          }

          stream.on('close', (code) => {
            clearTimeout(timer);
            conn.end();
            if (!timedOut) {
              resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
            }
          });

          stream.on('data', (data) => { stdout += data.toString(); });
          stream.stderr.on('data', (data) => { stderr += data.toString(); });
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
