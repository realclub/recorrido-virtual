import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { TourData } from './tour.models';

/** Hoy lee un JSON estático; luego apuntará a la API de Cloudflare Workers (D1). */
@Injectable({ providedIn: 'root' })
export class TourService {
  private http = inject(HttpClient);
  readonly data$: Observable<TourData> = this.http.get<TourData>('data/tour.json').pipe(shareReplay(1));
}
