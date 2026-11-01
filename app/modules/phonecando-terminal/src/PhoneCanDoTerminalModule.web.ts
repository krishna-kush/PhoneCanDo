import { registerWebModule, NativeModule } from 'expo';

// PhoneCanDoTerminalModule is not available on the web platform.
class PhoneCanDoTerminalModule extends NativeModule<{}> {}

export default registerWebModule(PhoneCanDoTerminalModule, 'PhoneCanDoTerminalModule');
