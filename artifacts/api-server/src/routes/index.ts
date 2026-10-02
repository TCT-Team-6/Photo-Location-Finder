import { Router, type IRouter } from "express";
import healthRouter from "./health";
import investigationsRouter from "./investigations";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(investigationsRouter);

export default router;
