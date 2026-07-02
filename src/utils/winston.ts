import winston from "winston";

// 🔹 Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 🔹 Environment-based log level
const level = () => {
  const env = process.env.NODE_ENV || "development";
  return env === "production" ? "debug" : "http";
};

// 🔹 Colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

// 🔹 Log format
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const isHttp = info.level.replace(/\u001b\[.*?m/g, "") === "http"; // strip ANSI codes
    if (isHttp) {
      return `${info.timestamp} ${info.level}: ${info.message}`;
    }
    return `${info.timestamp} ${info.level}: ${info.message}`;
  }),
);

// 🔹 Transports
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
  }),
  new winston.transports.File({ filename: "logs/all.log" }),
];

// 🔹 Logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;
