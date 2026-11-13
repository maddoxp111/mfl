// The school's calendar for 2026-27 (copied from its online calendar): the early dismissal days (out at 1:00pm, about three
// times the usual time to play, so picks on those games pay a third of their winnings: pickem.js isEarly) and the weekdays with
// no school (no game: a game left on one of those days is postponed and its picks refunded, server.js schoolDays).
// Update both lists when the school publishes next year's calendar.
const EARLY = ['2026-08-14', '2026-09-02', '2026-09-11', '2026-09-25', '2026-09-30', '2026-10-16', '2026-10-30', '2026-11-13', '2026-12-11', '2027-01-08', '2027-01-22', '2027-01-27', '2027-02-12', '2027-02-17', '2027-02-26', '2027-03-19', '2027-04-16', '2027-05-07', '2027-05-20'];
const OFF = {
  '2026-08-12': 'Institute day',
  '2026-08-13': 'Institute day',
  '2026-09-07': 'No school',
  '2026-09-21': 'No school',
  '2026-10-12': 'No school',
  '2026-11-03': 'No school',
  '2026-11-25': 'Thanksgiving break',
  '2026-11-26': 'Thanksgiving break',
  '2026-11-27': 'Thanksgiving break',
  '2026-12-21': 'Winter break',
  '2026-12-22': 'Winter break',
  '2026-12-23': 'Winter break',
  '2026-12-24': 'Winter break',
  '2026-12-25': 'Winter break',
  '2026-12-28': 'Winter break',
  '2026-12-29': 'Winter break',
  '2026-12-30': 'Winter break',
  '2026-12-31': 'Winter break',
  '2027-01-01': 'Winter break',
  '2027-01-04': 'Institute day',
  '2027-01-18': 'No school',
  '2027-02-15': 'No school',
  '2027-03-08': 'Spring break',
  '2027-03-09': 'Spring break',
  '2027-03-10': 'Spring break',
  '2027-03-11': 'Spring break',
  '2027-03-12': 'Spring break',
  '2027-03-26': 'No school',
  '2027-05-21': 'Institute day',
};
const isEarlyDay = (d) => EARLY.includes(d);
const offReason = (d) => OFF[d] || null;
module.exports = { EARLY, OFF, isEarlyDay, offReason };
