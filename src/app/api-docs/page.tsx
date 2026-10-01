'use client';

import { useEffect, useRef } from 'react';
import 'swagger-ui-dist/swagger-ui.css';

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Loaded lazily so the large Swagger UI bundle is only fetched on this page.
    import('swagger-ui-dist/swagger-ui-bundle.js')
      .then((module) => {
        const SwaggerUIBundle = module.default;
        if (cancelled || !containerRef.current) return;
        SwaggerUIBundle({ url: '/api/openapi.json', domNode: containerRef.current, deepLinking: true, tryItOutEnabled: true });
      })
      .catch((error) => console.error('Swagger UI failed to load:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  // Swagger UI ships a light stylesheet, so it sits on a white panel regardless of the active theme.
  return (
    <div className="p-4">
      <div ref={containerRef} className="rounded-xl overflow-hidden" style={{ background: '#fff', color: '#3b4151' }} />
    </div>
  );
}
