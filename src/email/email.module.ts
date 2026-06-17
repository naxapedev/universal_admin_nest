import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [forwardRef(() => LogsModule)],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
