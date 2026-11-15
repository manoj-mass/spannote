import { useEffect, useMemo, useState } from 'react';
import { SpanNoteProvider } from '@spannote/react';
import { Article } from './article';
import { CommentsPanel } from './comments-panel';
import { createDemoService, readConfig } from './config';
import { useHighlights } from './highlights';
import { PageChanges } from './page-changes';

export function App() {
  const config = useMemo(() => readConfig(window.location.search), []);
  const service = useMemo(() => createDemoService(config), [config]);
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState('Loading comments…');

  useHighlights(service, config.renderer);

  useEffect(() => {
    service
      .load()
      .then(() => {
        setMessage(
          `Loaded ${service.annotations.length} comment(s) from the ${config.store} store.`,
        );
      })
      .catch((error: unknown) => {
        setMessage(`Could not load comments: ${String(error)}`);
      });
  }, [service, config.store]);

  return (
    <SpanNoteProvider service={service} root={article}>
      <header className="page-header">
        <h1>SpanNote demo</h1>
        <p className="hint" data-testid="status">
          {message}
        </p>
        <p className="hint">
          Store: <code>{config.store}</code> · Renderer: <code>{config.renderer}</code>
          {config.store === 'w3c' ? (
            <>
              {' '}
              · Endpoint: <code>{config.endpoint}</code>
            </>
          ) : null}
        </p>
      </header>
      <main className="layout">
        <Article onRoot={setArticle} />
        <aside className="sidebar">
          <CommentsPanel article={article} service={service} report={setMessage} />
          <PageChanges article={article} service={service} report={setMessage} />
        </aside>
      </main>
    </SpanNoteProvider>
  );
}
