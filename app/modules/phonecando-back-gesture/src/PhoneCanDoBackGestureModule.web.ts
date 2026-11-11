import { registerWebModule, NativeModule } from 'expo';

// PhoneCanDoBackGestureModule is not available on the web platform.
class PhoneCanDoBackGestureModule extends NativeModule<{}> {}

export default registerWebModule(PhoneCanDoBackGestureModule, 'PhoneCanDoBackGestureModule');
