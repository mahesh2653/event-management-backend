import { Router } from "express";
import { body } from "express-validator";
import {
  createEvent,
  deleteEvent,
  listEvents,
  getEvent,
} from "../controllers/event.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { uploadEventPhotos } from "../config/upload";
import { validateRequest } from "../middleware/validate";

const router = Router();

// Public listing — no auth required, but honors requester's timezone
router.get("/", listEvents);
router.get("/:id", getEvent);

router.post(
  "/",
  requireAuth,
  uploadEventPhotos.array("photos", 10),
  [
    body("title").notEmpty(),
    body("description").notEmpty(),
    body("publishDate").notEmpty(),
    body("publishTime").notEmpty(),
    body("timezone").notEmpty(),
  ],
  validateRequest,
  createEvent,
);

router.delete("/:id", requireAuth, deleteEvent);

export default router;
