import express from "express";
import { getPublicStats } from "../../controllers/user/publicStats.controller.js";

const router = express.Router();

router.get("/stats", getPublicStats);

export default router;
