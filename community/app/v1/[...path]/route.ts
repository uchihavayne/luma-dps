import { env } from 'cloudflare:workers';
import { handleCommunity } from '@/lib/community.mjs';
const handler = (request: Request) => handleCommunity(request, env.DB);
export const GET = handler;
export const POST = handler;
export const DELETE = handler;
