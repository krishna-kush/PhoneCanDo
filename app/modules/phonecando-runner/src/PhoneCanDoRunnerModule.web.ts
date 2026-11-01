import { registerWebModule, NativeModule } from 'expo';

// PhoneCanDoRunnerModule is not available on the web platform.
class PhoneCanDoRunnerModule extends NativeModule<{}> {}

export default registerWebModule(PhoneCanDoRunnerModule, 'PhoneCanDoRunnerModule');
