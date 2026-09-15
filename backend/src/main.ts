import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Render (and most PaaS) terminate TLS at a proxy in front of us; trust it so
  // req.secure reflects the real client protocol (needed for secure cookies below).
  app.set('trust proxy', 1);
  // Serve the built Angular app if present (npm run build in ../frontend)
  const dist = join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser');
  if (existsSync(dist)) {
    app.useStaticAssets(dist);
    app.use((req: any, res: any, next: any) =>
      req.path.startsWith('/api') || req.path.includes('.') ? next() : res.sendFile(join(dist, 'index.html')),
    );
  }
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Foreman API on http://localhost:${port}`);
}
void bootstrap();
