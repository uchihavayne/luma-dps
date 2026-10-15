import { env } from 'cloudflare:workers';
import { handleCommunity } from '@/lib/community.mjs';
import { handleRooms } from '@/lib/rooms.mjs';
const handler = (request: Request) => new URL(request.url).pathname.startsWith('/v1/rooms') ? handleRooms(request, env.DB) : handleCommunity(request, env.DB);
export const GET = handler;
export const POST = handler;
export const DELETE = handler;
