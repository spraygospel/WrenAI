import { ERROR_TEXTS } from '@/utils/error';

export const hostValidator = (_, value) => {
  if (!value) {
    return Promise.reject(ERROR_TEXTS.CONNECTION.HOST.REQUIRED);
  }

  return Promise.resolve();
};