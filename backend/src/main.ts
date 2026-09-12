import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Serve the built Angular app if present (npm run build in ../frontend)
  const dist = join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser');
  if (existsSync(dist)) {
    app.useStaticAssets(dist);
    app.use((req: any, res: any, next: any) =>
      req.path.startsWith('/api') || req.path.includes('.') ? next() : res.sendFile(join(dist, 'index.html')),
    );
  }
  await app.listen(3000);
  console.log('Foreman API on http://localhost:3000');
}
void bootstrap();
