import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadSourceArchive } from './server/sourceDownload.mjs';
import { handleGoogleLedgerProxy } from './server/googleLedgerProxy.mjs';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(process.env.SOURCE_ROOT || rootDirectory);
const app = express();
const port = Number(process.env.PORT) || 8080;

app.get('/api/download-source', (request, response, next) => {
  downloadSourceArchive(request, response, next, sourceRoot);
});

app.post('/api/google-ledger', (request, response) => {
  handleGoogleLedgerProxy(request, response);
});

app.use(express.static(path.join(rootDirectory, 'dist')));
app.get('*', (_request, response) => {
  response.sendFile(path.join(rootDirectory, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Lucciem material system is listening on port ${port}.`);
});
