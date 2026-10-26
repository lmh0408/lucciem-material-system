import { ZipArchive } from 'archiver';

const sourceExcludes = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.env',
  '**/.env.*',
  '**/*.log',
  '**/.DS_Store',
  '**/*.zip',
];

export function downloadSourceArchive(request, response, next, sourceRoot) {
  const date = new Date().toISOString().slice(0, 10);
  response.setHeader('Content-Type', 'application/zip');
  response.setHeader('Content-Disposition', `attachment; filename="lucciem-material-system-source-${date}.zip"`);
  response.setHeader('Cache-Control', 'no-store');

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', next);
  response.on('close', () => {
    if (!response.writableEnded) archive.abort();
  });

  archive.pipe(response);
  archive.glob('**/*', { cwd: sourceRoot, dot: true, ignore: sourceExcludes });
  archive.finalize();
}
