import express from "express";
import { getAdvice } from "../controllers/agentController.js";

const router = express.Router();

router.post("/advice", getAdvice);

export { router as agentRoutes };
