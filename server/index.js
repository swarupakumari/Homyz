import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { userRoute } from './routes/userRoute.js';
import { residencyRoute } from './routes/residencyRoute.js';
import { aiRoutes } from './routes/aiRoutes.js';
import { agentRoutes } from './routes/agentRoutes.js';
import cors from "cors";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
 app.use('/api/user',userRoute)
 app.use("/api/residency", residencyRoute)
 app.use("/api/ai", aiRoutes)
 app.use("/api/agent", agentRoutes)
