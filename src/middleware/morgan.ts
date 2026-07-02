import morgan, { StreamOptions } from "morgan";
import logger from "../utils/winston";

const stream: StreamOptions = {
  write: (message) => {
    logger.http(message);
  },
};

const morganMiddleware = morgan(
  ":method :url :status :res[content-length] - :response-time ms",
  { stream },
);

export default morganMiddleware;
