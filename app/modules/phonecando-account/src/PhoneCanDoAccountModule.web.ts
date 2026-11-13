import { registerWebModule, NativeModule } from 'expo';

// PhoneCanDoAccountModule is not available on the web platform.
class PhoneCanDoAccountModule extends NativeModule<{}> {}

export default registerWebModule(PhoneCanDoAccountModule, 'PhoneCanDoAccountModule');
