import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import lottie, { type AnimationItem } from 'lottie-web';

import { BootstrapLoaderService } from '../../core/services/bootstrap-loader.service';

@Component({
  selector: 'app-splash-page',
  standalone: true,
  templateUrl: './splash-page.component.html',
  styleUrl: './splash-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashPageComponent implements OnInit, AfterViewInit {
  private static readonly MIN_SPLASH_MS = 4000;

  @ViewChild('animationHost', { static: true })
  private readonly animationHost!: ElementRef<HTMLDivElement>;

  private readonly loader = inject(BootstrapLoaderService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly progress = signal(8);

  private progressIntervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const preloadTask = this.loader.preloadCriticalData();
    const minTimeTask = new Promise<void>((resolve) => {
      this.zone.runOutsideAngular(() => {
        setTimeout(resolve, SplashPageComponent.MIN_SPLASH_MS);
      });
    });

    this.startFakeProgress();

    Promise.all([preloadTask, minTimeTask]).then(() => {
      this.stopFakeProgress();
      this.progress.set(100);
      this.router.navigateByUrl('/map', { replaceUrl: true });
    });
  }

  ngAfterViewInit(): void {
    const animation: AnimationItem = lottie.loadAnimation({
      container: this.animationHost.nativeElement,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: '/assets/pet-lovers.json',
    });

    this.destroyRef.onDestroy(() => {
      this.stopFakeProgress();
      animation.destroy();
    });
  }

  private startFakeProgress(): void {
    this.progressIntervalId = setInterval(() => {
      const next = Math.min(this.progress() + 3, 92);
      this.progress.set(next);
    }, 110);
  }

  private stopFakeProgress(): void {
    if (!this.progressIntervalId) {
      return;
    }

    clearInterval(this.progressIntervalId);
    this.progressIntervalId = null;
  }
}
