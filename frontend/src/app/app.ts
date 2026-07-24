import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { KubernetesService, Pod, Deployment } from './kubernetes.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  pods: Pod[] = [];
  deployments: Deployment[] = [];
  selectedPod: string | null = null;
  logLines: string[] = [];
  private logSubscription: Subscription | null = null;

  constructor(private k8s: KubernetesService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadPods();
    this.loadDeployments();
  }

  loadPods(): void {
    this.k8s.getPods().subscribe({
      next: data => {
        console.log('Pods received:', data);
        this.pods = data;
        this.cdr.detectChanges();
      },
      error: err => console.error('Failed to load pods:', err)
    });
  }

  loadDeployments(): void {
    this.k8s.getDeployments().subscribe({
      next: data => {
        this.deployments = data;
        this.cdr.detectChanges();
      },
      error: err => console.error('Failed to load deployments:', err)
    });
  }

  viewLogs(podName: string): void {
    this.selectedPod = podName;
    this.logLines = [];

    if (this.logSubscription) {
      this.logSubscription.unsubscribe();
    }

    this.logSubscription = this.k8s.streamLogs(podName).subscribe({
      next: line => {
        this.logLines = [...this.logLines, line];
        this.cdr.detectChanges();
      },
      error: err => {
        this.logLines = [...this.logLines, `Error: ${err}`];
        this.cdr.detectChanges();
      }
    });
  }

  closeLogs(): void {
    this.selectedPod = null;
    this.logLines = [];
    if (this.logSubscription) {
      this.logSubscription.unsubscribe();
      this.logSubscription = null;
    }
  }

  isErrorLine(line: string): boolean {
    return line.toLowerCase().includes('error') || line.toLowerCase().includes('warn');
  }

  ngOnDestroy(): void {
    if (this.logSubscription) {
      this.logSubscription.unsubscribe();
    }
  }
}
