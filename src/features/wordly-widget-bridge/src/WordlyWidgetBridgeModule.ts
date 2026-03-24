import { NativeModule, requireNativeModule } from 'expo';

declare class WordlyWidgetBridgeModuleType extends NativeModule {
  setSnapshotJson(json: string): Promise<void>;
}

export default requireNativeModule<WordlyWidgetBridgeModuleType>('WordlyWidgetBridge');
