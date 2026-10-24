import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let message = '文件上传失败';
    if (exception.code === 'LIMIT_FILE_SIZE') {
      message = '文件大小超出限制（视频最大 100MB，图片最大 10MB）';
    } else if (exception.code === 'LIMIT_UNEXPECTED_FILE') {
      message = '未预期的上传字段，请使用 "file" 字段名';
    } else {
      message = `文件上传错误: ${exception.message}`;
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: 'Bad Request',
    });
  }
}
