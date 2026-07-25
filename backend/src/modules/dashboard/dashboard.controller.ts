// ---------------------------------------------------------------------------
// DashboardController
// Phase 2 — Stub only.  Full REST API implementation is Phase 3.
// ---------------------------------------------------------------------------

import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Phase 3 will add:
  //   GET /dashboard/overview
  //   GET /dashboard/lessons
  //   GET /dashboard/students
  //   GET /dashboard/teachers
  //   GET /dashboard/finance
}
