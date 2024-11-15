import pino from "pino";
const logger = pino({
  level: "debug",
  name: "matcher",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

export default logger;
