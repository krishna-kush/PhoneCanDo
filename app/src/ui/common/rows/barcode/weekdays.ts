import type { BarcodeId } from './lines.ts';

const WEEKDAYS: readonly BarcodeId[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** A day's box's barcode line by its weekday, in the phone's own time zone ([at] any time that day). Pure (zero RN imports). */
export const weekdayBarcode = (at: number): BarcodeId => WEEKDAYS[new Date(at).getDay()];
