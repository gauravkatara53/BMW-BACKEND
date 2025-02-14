import Agenda from 'agenda';
import dotenv from 'dotenv';

dotenv.config();

export const agenda = new Agenda({
  db: { address: process.env.MONGODB_URI, collection: 'agendaJobs' },
});

(async function () {
  await agenda.start();
  console.log('Agenda started'); // Debugging log
})();
