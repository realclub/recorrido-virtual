import {
  Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import Marzipano from 'marzipano';
import { TourService } from '../tour.service';
import { Coverage, InfoHotspot, Scene, Venue } from '../tour.models';

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Limitador para panorámicas parciales: mantiene TODA la ventana visible dentro de la zona con imagen.
 * `fov` de Marzipano es vertical; el horizontal se deriva de la proporción actual de la pantalla.
 */
function coverageLimiter(c: Coverage, getSize: () => { w: number; h: number }) {
  const yMin = rad(c.yawMin), yMax = rad(c.yawMax), pMin = rad(c.pitchMin), pMax = rad(c.pitchMax);
  return (params: any) => {
    const { w, h } = getSize();
    const aspect = w > 0 && h > 0 ? w / h : 16 / 9;
    // el visor nunca debe ser más ancho/alto que la zona con imagen
    // la tangente solo es válida bajo 90°: con coberturas >170° se limita el semiancho
    const halfSpan = Math.min((yMax - yMin) / 2, rad(85));
    const maxVfov = Math.min(pMax - pMin, 2 * Math.atan(Math.tan(halfSpan) / aspect));
    params.fov = Math.min(params.fov, maxVfov);
    const vh = params.fov / 2;
    const hh = Math.atan(Math.tan(vh) * aspect); // medio campo horizontal
    const yaw = Math.atan2(Math.sin(params.yaw), Math.cos(params.yaw)); // normaliza a [-π, π]
    params.yaw = clamp(yaw, yMin + hh, Math.max(yMin + hh, yMax - hh));
    params.pitch = clamp(params.pitch, pMin + vh, Math.max(pMin + vh, pMax - vh));
    return params;
  };
}

const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14l6-6 6 6"/><path d="M6 20l6-6 6 6" opacity=".5"/></svg>';

@Component({
  selector: 'app-tour',
  imports: [RouterLink],
  templateUrl: './tour.html',
  styleUrl: './tour.scss',
})
export class Tour implements OnDestroy {
  // Parámetros de ruta (withComponentInputBinding)
  venueId = input.required<string>();
  sceneId = input<string>();

  private router = inject(Router);
  private data = toSignal(inject(TourService).data$);
  private panoEl = viewChild.required<ElementRef<HTMLElement>>('pano');
  private audioEl = viewChild<ElementRef<HTMLAudioElement>>('audio');

  venue = computed<Venue | undefined>(() => this.data()?.venues.find((v) => v.id === this.venueId()));
  scene = computed<Scene | undefined>(() => {
    const v = this.venue();
    if (!v) return undefined;
    return v.scenes.find((s) => s.id === this.sceneId()) ?? v.scenes.find((s) => s.id === v.startScene) ?? v.scenes[0];
  });
  index = computed(() => (this.venue()?.scenes.findIndex((s) => s.id === this.scene()?.id) ?? 0) + 1);
  links = computed(() => {
    const v = this.venue();
    const s = this.scene();
    if (!v || !s) return [];
    return s.hotspots.flatMap((h) => (h.type === 'link' ? [{ h, to: v.scenes.find((x) => x.id === h.target) }] : []));
  });

  menuOpen = signal(false);
  mapOpen = signal(true);
  autorotate = signal(false);
  fullscreen = signal(false);
  info = signal<InfoHotspot | null>(null);
  playing = signal(false);

  private viewer: any;
  private mzScenes = new Map<string, any>();
  private builtVenue?: string;
  private rotator: any;

  constructor() {
    effect(() => {
      const venue = this.venue();
      const scene = this.scene();
      if (!venue || !scene) return;
      this.ensureViewer();
      if (this.builtVenue !== venue.id) this.buildScenes(venue);
      this.show(scene);
    });
    document.addEventListener('fullscreenchange', this.onFs);
  }

  ngOnDestroy() {
    document.removeEventListener('fullscreenchange', this.onFs);
    this.viewer?.destroy();
  }

  go(sceneId: string) {
    this.menuOpen.set(false);
    this.router.navigate(['/sede', this.venueId(), sceneId]);
  }

  toggleAutorotate() {
    this.autorotate.update((v) => !v);
    if (this.autorotate()) this.viewer.startMovement(this.rotator);
    else this.viewer.stopMovement();
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  toggleAudio() {
    const a = this.audioEl()?.nativeElement;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }

  zoom(delta: number) {
    const view = this.viewer?.view();
    if (!view) return;
    view.setFov(Math.min(rad(100), Math.max(rad(40), view.fov() + delta)));
  }

  private onFs = () => this.fullscreen.set(!!document.fullscreenElement);

  private ensureViewer() {
    if (this.viewer) return;
    this.viewer = new Marzipano.Viewer(this.panoEl().nativeElement, {
      controls: { mouseViewMode: 'drag' },
    });
    this.rotator = Marzipano.autorotate({ yawSpeed: 0.04, targetPitch: 0, targetFov: Math.PI / 2 });
  }

  private buildScenes(venue: Venue) {
    this.mzScenes.clear();
    this.builtVenue = venue.id;
    const geometry = new Marzipano.EquirectGeometry([{ width: 4096 }]);
    const base = Marzipano.RectilinearView.limit.traditional(4096, rad(100));

    for (const s of venue.scenes) {
      const source = Marzipano.ImageUrlSource.fromString(s.pano);
      let view: any;
      const limiter = s.coverage
        ? Marzipano.util.compose(
            base,
            coverageLimiter(s.coverage, () => ({ w: view?.width() ?? 0, h: view?.height() ?? 0 })),
          )
        : base;
      view = new Marzipano.RectilinearView(
        { yaw: rad(s.initialView.yaw), pitch: rad(s.initialView.pitch), fov: rad(s.initialView.fov) },
        limiter,
      );
      const mz = this.viewer.createScene({ source, geometry, view, pixelRatio: 1 });

      const hc = mz.hotspotContainer();
      const noDrag = (el: HTMLElement) =>
        // evita que el arrastre del visor capture el clic en el hotspot
        ['pointerdown', 'touchstart', 'mousedown', 'wheel'].forEach((ev) =>
          el.addEventListener(ev, (e) => e.stopPropagation()),
        );

      for (const h of s.hotspots) {
        if (h.type === 'link') {
          const el = this.linkEl(h.label, h.yaw, h.pitch, h.target);
          noDrag(el);
          hc.createHotspot(el, { yaw: rad(h.yaw), pitch: rad(h.pitch) });
        } else {
          const el = this.infoEl(h);
          noDrag(el);
          hc.createHotspot(el, { yaw: rad(h.yaw), pitch: rad(h.pitch) });
        }
      }
      this.mzScenes.set(s.id, mz);
    }
  }

  private linkEl(label: string, yaw: number, pitch: number, target: string) {
    const el = document.createElement('button');
    el.className = 'hs hs-link';
    el.setAttribute('aria-label', `Ir a ${label}`);
    el.innerHTML = `<span class="orb">${ARROW_SVG}</span><span class="tag"></span>`;
    el.querySelector('.tag')!.textContent = label;
    el.addEventListener('click', () => this.travel(yaw, pitch, target));
    return el;
  }

  /** Desplaza suavemente la cámara hacia el hotspot (giro + zoom) y luego cambia de ambiente. */
  private traveling = false;
  private travel(yaw: number, pitch: number, target: string) {
    if (this.traveling) return;
    const view = this.viewer?.view();
    if (!view) return this.go(target);
    this.traveling = true;

    if (this.autorotate()) {
      this.autorotate.set(false);
      this.viewer.stopMovement();
    }
    const y0 = view.yaw();
    let dy = rad(yaw) - y0;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy)); // camino angular más corto
    const p0 = view.pitch();
    const dp = rad(Math.max(-5, Math.min(5, pitch + 8))) - p0; // mira un poco por encima del suelo
    const f0 = view.fov();
    const df = rad(52) - f0;
    const dur = 750;
    const t0 = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
      view.setParameters({ yaw: y0 + dy * e, pitch: p0 + dp * e, fov: f0 + df * e });
      if (t < 1) requestAnimationFrame(step);
      else {
        this.traveling = false;
        this.go(target);
      }
    };
    requestAnimationFrame(step);
  }

  private infoEl(h: InfoHotspot) {
    const el = document.createElement('button');
    el.className = 'hs hs-info';
    el.setAttribute('aria-label', `Información: ${h.title}`);
    el.innerHTML = '<span class="dot">i</span>';
    el.addEventListener('click', () => this.info.set(h));
    return el;
  }

  private show(scene: Scene) {
    const mz = this.mzScenes.get(scene.id);
    if (!mz) return;
    this.info.set(null);
    this.playing.set(false);
    const v = scene.initialView;
    mz.view().setParameters({ yaw: rad(v.yaw), pitch: rad(v.pitch), fov: rad(v.fov) });
    mz.switchTo({ transitionDuration: 900 });
    if (this.autorotate()) this.viewer.startMovement(this.rotator);
  }
}
