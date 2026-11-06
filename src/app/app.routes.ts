import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home').then((m) => m.Home) },
  { path: 'sede/:venueId', loadComponent: () => import('./tour/tour').then((m) => m.Tour) },
  { path: 'sede/:venueId/:sceneId', loadComponent: () => import('./tour/tour').then((m) => m.Tour) },
  { path: '**', redirectTo: '' },
];
