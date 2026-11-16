// A date as the pages print it, in the phone's own time zone: "3 Nov",
// "3 Nov 2025". Pure (zero RN imports).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3 Nov". */
export function dayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "3 Nov 2025". */
export function dayMonthYear(d: Date): string {
  return `${dayMonth(d)} ${d.getFullYear()}`;
}
