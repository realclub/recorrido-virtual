import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TourService } from '../tour.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  data = toSignal(inject(TourService).data$);
  totalScenes = computed(() => this.data()?.venues.reduce((n, v) => n + v.scenes.length, 0) ?? 0);
}
