# Angular

This guide shows how to add comments to an Angular 21 application with `@spannote/angular`. The reference is
[the Angular API page](../api/angular.md). A working example is in `apps/demo-angular`.

## 1. Install

```bash
npm install @spannote/core @spannote/angular @spannote/render
```

Angular `^21.0.0` and `rxjs ^7.8.0` must already be installed.

## 2. Create the service and provide it

```ts
// src/main.ts
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { provideSpanNote } from '@spannote/angular';
import { App } from './app';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });

bootstrapApplication(App, {
  providers: [provideZonelessChangeDetection(), provideSpanNote(service)],
}).catch((error: unknown) => {
  console.error(error);
});
```

Zoneless change detection is optional. The bindings use signals, so they work with or without zones.

## 3. Anchor the article

```ts
// src/app.ts
import { Component, ElementRef, viewChild } from '@angular/core';
import { attachSpanNoteRoot } from '@spannote/angular';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  private readonly article = viewChild<ElementRef<HTMLElement>>('article');

  constructor() {
    attachSpanNoteRoot(() => this.article()?.nativeElement);
  }
}
```

```html
<!-- src/app.html -->
<article #article ngPreserveWhitespaces>
  <p>Across the base, 12% of users churn each quarter after the first renewal.</p>
</article>
```

`ngPreserveWhitespaces` keeps the exact spacing of the text. Without it, Angular collapses extra spaces, and a
quote made from the text may no longer match the page.

## 4. Create a comment from a selection

Focusing a text box clears the page selection, so keep the last selection inside the article:

```ts
import { DestroyRef, inject } from '@angular/core';
import { injectSpanNote } from '@spannote/angular';

const service = injectSpanNote();
let lastRange: Range | undefined;

const onSelectionChange = (): void => {
  const range = window.getSelection()?.getRangeAt(0);
  if (range && article()?.contains(range.commonAncestorContainer) && !range.collapsed) {
    lastRange = range.cloneRange();
  }
};
document.addEventListener('selectionchange', onSelectionChange);
inject(DestroyRef).onDestroy(() =>
  document.removeEventListener('selectionchange', onSelectionChange),
);

async function submit(body: string): Promise<void> {
  if (lastRange) await service.createFromRange(lastRange, { body });
}
```

Call `injectSpanNote()` in the constructor or a field initialiser, where the injection context exists.

## 5. List the comments

```ts
import { injectAnchorStates, injectAnnotations } from '@spannote/angular';

export class CommentsComponent {
  readonly annotations = injectAnnotations();
  readonly anchors = injectAnchorStates();
}
```

```html
<ul>
  @for (a of annotations(); track a.id) {
  <li [attr.data-status]="anchors().get(a.id)?.status ?? 'unknown'">{{ a.body[0]?.value }}</li>
  }
</ul>
```

## 6. Draw the highlights

See [the highlight example](../api/angular.md#highlights).

## Pitfalls

- **Calling an inject function outside an injection context** throws. Call it in a constructor, a field
  initialiser, or `TestBed.runInInjectionContext` in tests.
- **Missing provider:** the error says `needs provideSpanNote(service)`. Add the provider to the application's
  providers, or to the route providers of the routes that use it.
- **Two applications on one page** each need their own service, or the second one replaces the first.
- **Changing ids:** use `injectAnchor(() => this.id())` so the signal follows the id.
- **Edited article DOM:** Angular does not patch an element with no bindings, so keep the article free of
  bindings if your code edits it.
