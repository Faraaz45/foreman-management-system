import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DbService } from './db.service';
import { AuthController, AuthGuard } from './auth';
import { ApiController } from './api.controller';

@Module({
  controllers: [AuthController, ApiController],
  providers: [DbService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
