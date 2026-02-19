import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { createProxyServer, type ServerOptions } from 'http-proxy';
import { InfraGatewayService } from './infra-gateway.service';

function rejectUpgrade(socket: Socket): void {
  socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
  socket.destroy();
}

interface ProxySocketLike {
  destroyed?: boolean;
  write: (chunk: string) => boolean;
  destroy: () => void;
}

function rejectProxyError(socket: ProxySocketLike): void {
  if (!socket.destroyed) {
    socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    socket.destroy();
  }
}

function isWebSocketUpgrade(req: IncomingMessage): boolean {
  return String(req.headers.upgrade || '').toLowerCase() === 'websocket';
}

function createWsProxy(): ReturnType<typeof createProxyServer> {
  const options: ServerOptions = {
    secure: false,
    changeOrigin: true,
    ws: true,
  };
  return createProxyServer(options);
}

export function attachInfraGatewayUpgradeHandler(params: {
  server: HttpServer;
  gatewayService: InfraGatewayService;
}): void {
  const { server, gatewayService } = params;
  const proxmoxWsProxy = createWsProxy();
  const tinyFmWsProxy = createWsProxy();
  const syncThingWsProxy = createWsProxy();

  const allProxies = [proxmoxWsProxy, tinyFmWsProxy, syncThingWsProxy];
  for (const proxy of allProxies) {
    proxy.on('error', (_error, _req, socket) => {
      rejectProxyError(socket as ProxySocketLike);
    });
  }

  server.on('upgrade', (req, socket, head) => {
    const upgradeSocket = socket as Socket;
    if (!isWebSocketUpgrade(req)) {
      return;
    }

    const pathname = new URL(String(req.url || '/'), 'http://localhost').pathname;
    const directRoute = gatewayService.resolveGatewayRoute(pathname);
    const hintedService = gatewayService.inferServiceFromRequestHints(req.headers);
    const service = directRoute?.service || hintedService;
    if (!service) {
      return;
    }

    const authorized = gatewayService.hasGatewayAuthorization(req.headers, req.url);
    if (!authorized) {
      rejectUpgrade(upgradeSocket);
      return;
    }

    if (service === 'tinyfm') {
      tinyFmWsProxy.ws(req, upgradeSocket, head, { target: gatewayService.getTinyFmTarget() });
      return;
    }

    if (service === 'syncthing') {
      syncThingWsProxy.ws(req, upgradeSocket, head, {
        target: gatewayService.getSyncThingTarget(),
      });
      return;
    }

    proxmoxWsProxy.ws(req, upgradeSocket, head, { target: gatewayService.getProxmoxTarget() });
  });
}
