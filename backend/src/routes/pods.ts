import { Router, Request, Response } from 'express';
import { coreV1Api } from '../k8s/client';

const router = Router();

interface Pod {
  name: string;
  status: string;
  namespace: string;
}

router.get('/', async (req: Request, res: Response) => {
  const namespace = (req.query.namespace as string) || 'default';
  try {
    const result = await coreV1Api.listNamespacedPod({ namespace });
    const pods: Pod[] = result.items.map(pod => ({
      name: pod.metadata?.name ?? 'unknown',
      status: pod.status?.phase ?? 'unknown',
      namespace: pod.metadata?.namespace ?? 'unknown',
    }));
    res.json(pods);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
