import multer from 'multer';
import { config } from '../config.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadBytes,
  },
});
