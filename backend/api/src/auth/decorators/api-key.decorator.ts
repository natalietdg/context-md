import { SetMetadata } from '@nestjs/common';

export const API_KEY_BYPASS_KEY = 'apiKeyBypass';
export const ApiKeyBypass = () => SetMetadata(API_KEY_BYPASS_KEY, true);
