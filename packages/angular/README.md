# @spannote/angular

Angular bindings for SpanNote: environment providers that register the annotation service, signal
functions that read its state, and a function that attaches the service to a DOM root.

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { provideSpanNote } from '@spannote/angular';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });
bootstrapApplication(App, { providers: [provideSpanNote(service)] });
```

```ts
import { Component, ElementRef, viewChild } from '@angular/core';
import { attachSpanNoteRoot, injectAnnotations } from '@spannote/angular';

@Component({
  selector: 'app-article',
  template: `<article #article>…</article>
    <ul>
      @for (a of annotations(); track a.id) {
        <li>{{ a.body[0]?.value }}</li>
      }
    </ul>`,
})
export class ArticleComponent {
  private readonly article = viewChild<ElementRef<HTMLElement>>('article');
  readonly annotations = injectAnnotations();

  constructor() {
    attachSpanNoteRoot(() => this.article()?.nativeElement);
  }
}
```

- Requires Angular `^21.0.0` and `rxjs ^7.8.0`. The package does not bundle Angular.
- Inject functions must run in an injection context: a constructor, a field initialiser, or
  `TestBed.runInInjectionContext`.
- `injectAnchor(() => id)` follows an id that changes.
- Add `ngPreserveWhitespaces` to text whose exact spacing matters for anchoring.

Full reference and a guide: [docs/api/angular.md](https://github.com/manoj-mass/spannote/blob/main/docs/api/angular.md)
and [docs/guides/angular.md](https://github.com/manoj-mass/spannote/blob/main/docs/guides/angular.md).
