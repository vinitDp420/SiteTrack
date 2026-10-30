import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi';

const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SiteTrack API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    #swagger-ui { margin: 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      const spec = ${JSON.stringify(openApiSpec)};
      SwaggerUIBundle({
        dom_id: '#swagger-ui',
        spec: spec,
        presets: [
          SwaggerUIBundle.presets.apis,
        ],
        layout: 'StandaloneLayout',
        docExpansion: 'list',
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>
`;

export async function GET() {
  return new NextResponse(swaggerHtml, {
    headers: { 'Content-Type': 'text/html' },
  });
}
