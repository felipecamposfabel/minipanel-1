import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

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
