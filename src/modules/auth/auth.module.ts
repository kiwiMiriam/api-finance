import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseConfigService } from '../../config/supabase.config';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseConfigService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
