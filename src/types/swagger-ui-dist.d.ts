declare module 'swagger-ui-dist/swagger-ui-bundle.js' {
  const SwaggerUIBundle: (config: {
    url: string;
    domNode: HTMLElement;
    deepLinking?: boolean;
    tryItOutEnabled?: boolean;
  }) => unknown;
  export default SwaggerUIBundle;
}
