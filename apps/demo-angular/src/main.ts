import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideSpanNote } from '@spannote/angular';
import { App } from './app';
import { createDemoService, readConfig } from './config';

const service = createDemoService(readConfig(window.location.search));

bootstrapApplication(App, {
  providers: [provideZonelessChangeDetection(), provideSpanNote(service)],
}).catch((error: unknown) => {
  console.error(error);
});
