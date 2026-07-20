"""Edit script for contract.controller.ts - run by CC via Bash tool"""
import pathlib

fp = pathlib.Path(r'C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4\backend\src\modules\teaching\contract\contract.controller.ts')
content = fp.read_text('utf-8')

# Edit 1: Add ApiParam to import
old1 = "import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';"
new1 = "import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';"

# Edit 2: Add @ApiParam decorator
old2 = "  @Get('students/:studentCode/contracts')\n  @ApiOperation({ summary: 'Get all contracts for a student' })\n  findByStudentCode(@Param('studentCode') studentCode: string) {"
new2 = "  @Get('students/:studentCode/contracts')\n  @ApiParam({ name: 'studentCode', description: '学生编号' })\n  @ApiOperation({ summary: 'Get all contracts for a student' })\n  findByStudentCode(@Param('studentCode') studentCode: string) {"

assert old1 in content, "Edit 1: old text not found"
assert old2 in content, "Edit 2: old text not found"

content = content.replace(old1, new1)
content = content.replace(old2, new2)

fp.write_text(content, 'utf-8')
print(f"Done. Applied 2 edits to {fp.name}")
