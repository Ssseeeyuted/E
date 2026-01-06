import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './src/app.component';
import { provideZonelessChangeDetection } from '@angular/core';

function bootstrap() {
  bootstrapApplication(AppComponent, {
    providers: [
      provideZonelessChangeDetection()
    ]
  }).catch(err => console.error(err));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// AI Studio always uses an `index.tsx` file for all project types.
