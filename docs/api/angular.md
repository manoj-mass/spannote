# @spannote/angular

Angular bindings: environment providers that register the annotation service, signal-based functions that
read its state, and a function that attaches it to a DOM root.

```ts
import {
  SPANNOTE_SERVICE,
  provideSpanNote,
  injectSpanNote,
  injectAnnotations,
  injectAnchorStates,
  injectAnchor,
  attachSpanNoteRoot,
} from '@spannote/angular';
```

Requires Angular `^21.0.0` and `rxjs ^7.8.0`. The package has no runtime dependency on Angular; the
application's Angular is the one used. The package is built with ng-packagr in partial compilation mode, so
it works with any Angular CLI project that uses Angular 21.

## provideSpanNote(service)

```ts
function provideSpanNote(service: AnnotationService): EnvironmentProviders;
```

Registers the service for the application. Create the service once, outside any component:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { provideSpanNote } from '@spannote/angular';

const service = new AnnotationService({ store: new MemoryAnnotationStore() });

bootstrapApplication(App, {
  providers: [provideZonelessChangeDetection(), provideSpanNote(service)],
});
```

`provideSpanNote` returns `EnvironmentProviders`, so it can go in `bootstrapApplication` or in the
`providers` of a route.

## SPANNOTE_SERVICE

```ts
const SPANNOTE_SERVICE: InjectionToken<AnnotationService>;
```

The token that `provideSpanNote` registers. Read it with `inject()` if you prefer the token to the function.

## injectSpanNote()

```ts
function injectSpanNote(): AnnotationService;
```

Returns the service, for calls such as `createFromRange`, `reply`, `update` and `remove`. It must run in an
injection context: a constructor, a field initialiser, or `TestBed.runInInjectionContext`. It throws
`injectSpanNote() needs provideSpanNote(service) in the application providers.` when the provider is missing.

## injectAnnotations()

```ts
function injectAnnotations(): Signal<readonly Annotation[]>;
```

The current annotations, sorted by `created`. The signal is set when the service emits `change`. It is read
only, and the subscription ends when the injector is destroyed.

## injectAnchorStates()

```ts
function injectAnchorStates(): Signal<ReadonlyMap<string, AnchorState>>;
```

The anchor state of every annotation. The signal is set when the service emits `anchors`.

## injectAnchor(annotationId)

```ts
function injectAnchor(annotationId: () => string): Signal<AnchorState | undefined>;
```

The anchor state of one annotation. Pass a function (`() => this.id()`) so the signal follows an id that
changes.

## attachSpanNoteRoot(root)

```ts
function attachSpanNoteRoot(root: () => Node | null | undefined): void;
```

Attaches the service to the node that `root` returns, and re-attaches when the node changes. A `null` or
`undefined` node detaches the service. The service is detached when the injector is destroyed.

Attaching runs in an `effect`, so it happens during change detection, not immediately. Call it in an injection
context. A typical use reads a view child:

```ts
import { Component, ElementRef, viewChild } from '@angular/core';
import { attachSpanNoteRoot } from '@spannote/angular';

@Component({
  selector: 'app-article',
  template: `<article #article><p>Across the base, 12% of users churn each quarter.</p></article>`,
})
export class ArticleComponent {
  private readonly article = viewChild<ElementRef<HTMLElement>>('article');

  constructor() {
    attachSpanNoteRoot(() => this.article()?.nativeElement);
  }
}
```

## Highlights

The functions do not draw highlights. Draw them from `injectAnchorStates()` with `@spannote/render`. The demo
does this inside an `effect`:

```ts
const highlights = createHighlightRenderer();
const anchors = injectAnchorStates();

effect(() => {
  const ranges = [...anchors().values()].flatMap((s) => (s.range ? [s.range] : []));
  highlights.draw('comments', ranges);
});
```

## Keeping the article's DOM

Angular patches the DOM that its template renders. If your code edits the article's DOM directly, keep that part
of the page free of bindings, or keep the editing code outside Angular's view. The demo's page-change buttons
edit the article, so its article has no bindings.

Angular also collapses runs of whitespace in template text by default. Add `ngPreserveWhitespaces` to an element
whose text must keep its exact spacing, which matters when a quote contains extra spaces.

## Measured behaviour

The Angular demo passes the same six browser scenarios as the React and Vue demos (`npm run demo:smoke` with
`DEMO_URL` pointing at the Angular demo). See [the demo guide](../guides/demo.md).
