import { Router, Request, Response } from 'express';
import { appsV1Api } from '../k8s/client';

const router = Router();

interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
}

router.get('/', async (req: Request, res: Response) => {
  const namespace = (req.query.namespace as string) || 'default';
  try {
    const result = await appsV1Api.listNamespacedDeployment({ namespace });
    const deployments: Deployment[] = result.items.map(dep => ({
      name: dep.metadata?.name ?? 'unknown',
      namespace: dep.metadata?.namespace ?? 'unknown',
      replicas: dep.spec?.replicas ?? 0,
      readyReplicas: dep.status?.readyReplicas ?? 0,
    }));
    res.json(deployments);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
