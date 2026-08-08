import express from "express";
import { searchWithAI } from "../controllers/aiController.js";

const router = express.Router();

router.post("/search", searchWithAI);

export { router as aiRoutes };
