import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import eventsRouter from './routes/events.js';
import seedRouter from './routes/seed.js';
import exploreRouter from './routes/explore.js';
import trendsRouter from './routes/trends.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

app.use('/api/events', eventsRouter);
app.use('/api/seed', seedRouter);
app.use('/api/explore', exploreRouter);
app.use('/api/trends', trendsRouter);

async function start(): Promise<void> {
  await initDb();
  console.log('Database initialized');

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
