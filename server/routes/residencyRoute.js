import express from "express";
import {
  createResidency,
  getAllResidencies,
  getResidency,
  searchResidencies,
} from "../controllers/resdCntrl.js";
import jwtCheck from "../config/auth0Config.js";
const router = express.Router();

router.post("/create", jwtCheck, createResidency);
router.get("/allresd", getAllResidencies);
// Must be registered before "/:id" or Express would match "search" as an id param.
router.get("/search", searchResidencies);
router.get("/:id", getResidency);
export { router as residencyRoute };
