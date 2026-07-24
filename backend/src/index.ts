import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { URL } from 'url';
import { PassThrough } from 'stream';
import * as k8s from '@kubernetes/client-node';
import podsRouter from './routes/pods';
import deploymentsRouter from './routes/deployments';

const app = express();
const PORT = 3000;

const kubeConfig = new k8s.KubeConfig();
kubeConfig.loadFromDefault();
const log = new k8s.Log(kubeConfig);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Kubernetes Dashboard Backend is running.');
});

app.use('/api/pods', podsRouter);
app.use('/api/deployments', deploymentsRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket, req) => {
  const params = new URL(req.url ?? '', `http://localhost:${PORT}`).searchParams;
  const podName = params.get('pod');
  const namespace = params.get('namespace') ?? 'default';

  if (!podName) {
    ws.send('Error: pod name is required');
    ws.close();
    return;
  }

  try {
    const logStream = new PassThrough();

    logStream.on('data', (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk.toString());
      }
    });

    logStream.on('end', () => ws.close());

    ws.on('close', () => logStream.destroy());

    await log.log(namespace, podName, '', logStream, { follow: true, pretty: false });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`Error: ${message}`);
      ws.close();
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
