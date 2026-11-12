import { Router, type IRouter } from "express";
import healthRouter from "./health";
import investigationsRouter from "./investigations";
import storageRouter from "./storage";
import casesRouter from "./cases";
import guideRouter from "./guide";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(casesRouter);
router.use(guideRouter);
router.use(investigationsRouter);

export default router;
