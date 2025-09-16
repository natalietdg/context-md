import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('db/sync')
  @HttpCode(HttpStatus.OK)
  async syncDb(@Body() body: { drop?: boolean }) {
    return this.adminService.syncSchema({ drop: !!body?.drop });
  }

  @Post('db/seed')
  @HttpCode(HttpStatus.OK)
  async seed() {
    return this.adminService.seedBasic();
  }

  @Post('db/insert')
  @HttpCode(HttpStatus.OK)
  async insert(@Body() body: { entity: 'doctor' | 'patient' | 'user'; records: any[] }) {
    return this.adminService.insertRecords(body);
  }

  // Insert into the raw SQL `users` table created by migrations (email, password_hash/role)
  @Post('db/insert-sql-users')
  @HttpCode(HttpStatus.OK)
  async insertSqlUsers(@Body() body: { records: Array<{ email: string; password?: string; password_hash?: string; role: string }> }) {
    return this.adminService.insertSqlUsers(body);
  }
}
