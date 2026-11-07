import { registerWebModule, NativeModule } from 'expo';

import type { LinuxStatus } from './PhoneCanDoLinux.types';

export type { LinuxStatus } from './PhoneCanDoLinux.types';

// PhoneCanDoLinuxModule is not available on the web platform.
class PhoneCanDoLinuxModule extends NativeModule<{}> {}

export function linuxStatus(): LinuxStatus {
  return { available: false, reason: 'no Linux on the web', libDir: '', launcher: '', proot: '', loader: '' };
}

export default registerWebModule(PhoneCanDoLinuxModule, 'PhoneCanDoLinuxModule');
