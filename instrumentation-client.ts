import { initBotId } from "botid/client/core";

// Attach BotID classification headers to requests hitting protected routes.
// The server side enforces via checkBotId() in the matching route handlers.
initBotId({
  protect: [
    {
      path: "/api/airports/*/reviews",
      method: "POST",
    },
    {
      path: "/api/airports/*/generate",
      method: "POST",
    },
  ],
});
