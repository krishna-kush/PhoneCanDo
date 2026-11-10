import { registerWebModule, NativeModule } from 'expo';

// PhoneCanDoModelsModule is not available on the web platform.
class PhoneCanDoModelsModule extends NativeModule<{}> {}

export default registerWebModule(PhoneCanDoModelsModule, 'PhoneCanDoModelsModule');
