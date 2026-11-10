import { NativeModule, requireNativeModule } from 'expo';

type ModelsEvents = {
  phonecandoModelsProgress(e: Record<string, unknown>): void;
  phonecandoModelsChanged(e: Record<string, never>): void;
};

// Only loads the module. Its typed surface (device, Hugging Face, downloads,
// imports, the token) is declared in the engine seam
// app/src/engine/models/native.ts, next to the JS contract types
// (app/src/engine/models/types.ts) the native maps follow.
declare class PhoneCanDoModelsModule extends NativeModule<ModelsEvents> {}

export default requireNativeModule<PhoneCanDoModelsModule>('PhoneCanDoModels');
