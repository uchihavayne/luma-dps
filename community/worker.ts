import handler from "vinext/server/fetch-handler";

export default {
  fetch(request: Request, env: Cloudflare.Env, context: ExecutionContext) {
    return handler.fetch(request, env, context);
  },
};
