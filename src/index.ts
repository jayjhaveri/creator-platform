import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
dotenv.config();

import { setupSwagger } from './docs/swagger';

import healthRoutes from './routes/health';
import brandRoutes from './routes/brands';
import creatorRoutes from './routes/creator';
import campaignRoutes from './routes/campaigns';
import negotiationRoutes from './routes/negotiations';
import communicationRoutes from './routes/communications';
import dealRoutes from './routes/deals';
import inboundEmailRoutes from './routes/inboundEmail';
import { requestLogger } from './middleware/requestLogger';
import taskRoutes from './routes/taskRoutes';


const app = express();
const PORT = process.env.PORT || 8080;

// Security & middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(requestLogger);

// Swagger
setupSwagger(app);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/negotiations', negotiationRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/deals', dealRoutes);
app.use('/inbound-email', inboundEmailRoutes);

app.use('/tasks', taskRoutes);

app.use('/', (req, res) => {
    res.status(200).send('Welcome to the Creator Platform API! Use /api/docs for API documentation.');
}
);

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});