import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { User } from "./entities/User";
import { Session } from "./entities/Session";
import { Category } from "./entities/Category";
import { Event } from "./entities/Event";
import { EventMedia } from "./entities/EventMedia";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "event_portal",
  synchronize: process.env.NODE_ENV !== "production", // dev convenience; use migrations in prod
  logging: false,
  entities: [User, Session, Category, Event, EventMedia],
  migrations: ["src/migrations/*.ts"],
});
