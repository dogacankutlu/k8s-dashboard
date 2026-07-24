import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Pod {
  name: string;
  status: string;
  namespace: string;
}

export interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
}

@Injectable({
  providedIn: 'root'
})
export class KubernetesService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getPods(namespace: string = 'default'): Observable<Pod[]> {
    return this.http.get<Pod[]>(`${this.baseUrl}/api/pods?namespace=${namespace}`);
  }

  getDeployments(namespace: string = 'default'): Observable<Deployment[]> {
    return this.http.get<Deployment[]>(`${this.baseUrl}/api/deployments?namespace=${namespace}`);
  }

  streamLogs(podName: string, namespace: string = 'default'): Observable<string> {
    return new Observable(observer => {
      const ws = new WebSocket(`ws://localhost:3000?pod=${podName}&namespace=${namespace}`);

      ws.onmessage = event => observer.next(event.data);
      ws.onerror = () => observer.error('WebSocket error');
      ws.onclose = () => observer.complete();

      return () => ws.close();
    });
  }
}
